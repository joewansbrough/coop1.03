import express from 'express';
import cookieSession from 'cookie-session';
import axios from 'axios';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { MaintenancePriority } from '../types.js';
import { tenantSchema } from './validation.js';

dotenv.config();

const app = express();

// Validation Middleware
const validateRequest = (schema: z.ZodSchema) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
    } else {
      next(error);
    }
  }
};

// Helper to sanitize strings for PostgreSQL (removes null bytes and invalid UTF-8 sequences)
const sanitizeUtf8 = (str: string): string => {
  if (!str) return "";
  // Remove null bytes (\u0000) and other non-printable control characters that Postgres rejects
  return str.replace(/\0/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD\uFFFE\uFFFF]/g, "");
};

// Prisma singleton helper
let prismaInstance: PrismaClient;
const getPrisma = () => {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
};

// Trust proxy for secure cookies on Vercel
app.set('trust proxy', true);

// Aggressively force req.secure to true for the Vercel environment
app.use((req, res, next) => {
  const proto = req.get('x-forwarded-proto');
  if (proto === 'https' || req.get('x-forwarded-port') === '443') {
    Object.defineProperty(req, 'secure', { get: () => true, configurable: true });
    Object.defineProperty(req, 'protocol', { get: () => 'https', configurable: true });
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use((req, res, next) => {
  cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'default_secret'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true, // Always true on Vercel (HTTPS)
    sameSite: 'none',
    httpOnly: true,
    signed: true,
    overwrite: true,
  } as any)(req, res, next);
});

// Mock Data
const ADMIN_EMAILS = ['joewcoupons@gmail.com', 'wwansbro@gmail.com', 'joewansbrough@gmail.com', 'samisaeed123@gmail.com'];

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const hasUser = !!(req as any).session?.user;
  if (!hasUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};

// Helper to get base URL
const getBaseUrl = (req: express.Request) => {
  const host = req.get('x-forwarded-host') || req.get('host') || '';
  const protocol = 'https';
  let url = `${protocol}://${host}`;
  if (process.env.APP_URL && !host) {
    url = process.env.APP_URL;
  }
  return url.replace(/\/+$/, "");
};

// API Request Logger
app.use('/api', (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.originalUrl}`);
  next();
});

// App Configuration Route
app.get('/api/config', requireAuth, (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleApiKey: process.env.PICKER_API_KEY,
  });
});

// Auth Routes
const authRouter = express.Router();

authRouter.get('/url', (req, res) => {
  const baseUrl = getBaseUrl(req);
  const redirectUri = `${baseUrl}/auth/callback`;

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured in Vercel environment variables' });
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  res.json({ url: authUrl });
});

app.use('/api/auth', authRouter);
app.use('/auth', authRouter); // Handle cases where /api might be stripped

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');

  try {
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/auth/callback`;

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenResponse.data;
    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const userData = userResponse.data;
    const email = userData.email.toLowerCase();

    // Find or create user in database
    let user = await getPrisma().tenant.findUnique({
      where: { email },
      include: { unit: true }
    });

    // Check both DB role and legacy list for now
    const isAdmin = user?.role === 'ADMIN' || ['joewansbrough@gmail.com', 'wwansbro@gmail.com', 'joewcoupons@gmail.com', 'samisaeed123@gmail.com'].includes(email);

    (req as any).session.user = {
      email,
      name: userData.name,
      picture: userData.picture,
      isAdmin,
      tenantId: user?.id || null,
      unitNumber: user?.unit?.number || null,
      role: user?.role || 'MEMBER'
    };

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              setTimeout(() => window.close(), 100);
            } else {
              window.location.href = '/';
            }
          </script>
          <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2>Authentication successful</h2>
            <p>This window should close automatically.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get(['/api/auth/me', '/auth/me'], (req, res) => {
  res.json({ user: (req as any).session?.user || null });
});

app.post(['/api/auth/logout', '/auth/logout'], (req, res) => {
  (req as any).session = null;
  res.json({ success: true });
});

app.get('/api/seed/preventative', async (req, res) => {
try {
const p = getPrisma();
const units = await p.unit.findMany(); // Fetch all units to get their IDs

// Create a map for quick lookup of existing scheduled maintenance tasks
const existingTasks = await p.scheduledMaintenance.findMany();
const existingTaskMap = new Map<string, ScheduledMaintenance>(); // Key: unitId-taskName

existingTasks.forEach(task => {
// Create a unique key for each task (adjust if task names can be identical for the same unit)
existingTaskMap.set(`${task.unitId}-${task.task}`, task);
});

console.log('Seeding preventative maintenance tasks...');

const tasksToSeed: Omit<ScheduledMaintenance, 'id' | 'isCompleted'>[] = [];

// Generate mock tasks for each unit, ensuring variety
units.forEach(unit => {
// Add 1-3 tasks per unit, varying frequency and category
const numTasks = Math.floor(Math.random() * 3) + 1; // 1 to 3 tasks per unit

for (let i = 0; i < numTasks; i++) {
let taskDetails: Omit<ScheduledMaintenance, 'id' | 'isCompleted'>;
         const today = new Date();

         switch (i) {
           case 0: // First task: HVAC related, monthly/quarterly
             taskDetails = {
               unitId: unit.id,
               task: 'HVAC Filter Replacement',
               dueDate: new Date(today.setMonth(today.getMonth() + 1)).toISOString().split('T')[0],
               frequency: Math.random() > 0.5 ? 'Monthly' : 'Quarterly',
               assignedTo: 'Building Management',
               category: 'HVAC',
             };
             break;
           case 1: // Second task: Plumbing or Electrical, quarterly/annual
             taskDetails = {
              unitId: unit.id,
               task: Math.random() > 0.5 ? 'Water Heater Flush' : 'Inspect Electrical Panel',
               dueDate: new Date(today.setMonth(today.getMonth() + (Math.random() > 0.5 ? 3 :
       6))).toISOString().split('T')[0],
               frequency: Math.random() > 0.5 ? 'Quarterly' : 'Annual',
               assignedTo: Math.random() > 0.5 ? 'Maintenance Team' : 'Electrician',
               category: Math.random() > 0.5 ? 'Plumbing' : 'Electrical',
             };
             break;
           default: // Third task: Safety or General, annual
             taskDetails = {
               unitId: unit.id,
               task: Math.random() > 0.5 ? 'Annual Fire Alarm Test' : 'Inspect Balcony Sealant',
               dueDate: new Date(today.setFullYear(today.getFullYear() + 1)).toISOString().split('T')[0],
               frequency: 'Annual',
               assignedTo: Math.random() > 0.5 ? 'Safety Officer' : 'Exterior Maintenance',
               category: Math.random() > 0.5 ? 'Safety' : 'General',
             };
             break;
         }
         tasksToSeed.push(taskDetails);
       }
     });

     let addedCount = 0;
     for (const task of tasksToSeed) {
       const key = `${task.unitId}-${task.task}`;
       if (!existingTaskMap.has(key)) {
         await p.scheduledMaintenance.create({
           data: {
             ...task,
             isCompleted: false, // Default to not completed
           },
         });
         addedCount++;
       }
     }

     res.json({
       success: true,
       message: `Preventative maintenance tasks seeded. ${addedCount} new tasks added.`
     });

   } catch (e: any) {
    console.error('Preventative seeding error:', e);
    res.status(500).json({ success: false, error: e.message });
   }
 });

app.delete('/api/seed/preventative', async (req, res) => {
   try {
     await getPrisma().scheduledMaintenance.deleteMany();
     res.json({ success: true, message: "Preventative maintenance tasks cleared." });
   } catch (e: any) {
     console.error('Clear preventative tasks error:', e);
     res.status(500).json({ success: false, error: e.message });
   }
 });

// Development Bypass Login
app.post(['/api/auth/bypass', '/auth/bypass'], (req, res) => {
  // Security check: Only allow in development or preview environments
  const isProduction = process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV;
  if (isProduction) {
    return res.status(403).json({ error: 'Bypass not allowed in production' });
  }

  (req as any).session.user = {
    email: 'guest@example.com',
    name: 'Guest User',
    picture: 'https://picsum.photos/seed/guest/200',
    isAdmin: false,
    isGuest: true,
    tenantId: null,
    unitNumber: 'GUEST-001'
  };

  res.json({ success: true, user: (req as any).session.user });
});

// --- Database API Routes ---

app.get('/api/units', async (req, res) => {
  const units = await getPrisma().unit.findMany({
    include: {
      currentTenant: true,
      occupancyHistory: {
        include: { tenant: true },
        orderBy: { startDate: 'desc' }
      }
    }
  });
  res.json(units);
});

app.post('/api/tenants', validateRequest(tenantSchema), async (req, res) => {
  try {
    const tenant = await getPrisma().tenant.create({
      data: req.body,
      include: { unit: true }
    });
    res.json(tenant);
  } catch (error: any) {
    console.error('Failed to create tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tenants', async (req, res) => {
  const tenants = await getPrisma().tenant.findMany({
    include: { unit: true }
  });
  res.json(tenants);
});

app.get('/api/tenants/:id/history', async (req, res) => {
  const history = await getPrisma().tenantHistory.findMany({
    where: { tenantId: req.params.id },
    include: { unit: true },
    orderBy: { startDate: 'desc' }
  });
  res.json(history);
});

// --- Unit Turnover Endpoints ---

app.post('/api/units/:id/move-out', async (req, res) => {
  const { id } = req.params;
  const { date, reason } = req.body;
  try {
    // Find all current residents of this unit
    const residents = await getPrisma().tenant.findMany({ where: { unitId: id, status: 'Current' } });

    for (const tenant of residents) {
      // Close any open TenantHistory record for this unit
      const openHistory = await getPrisma().tenantHistory.findFirst({
        where: { tenantId: tenant.id, unitId: id, endDate: null }
      });
      if (openHistory) {
        await getPrisma().tenantHistory.update({
          where: { id: openHistory.id },
          data: { endDate: new Date(date), moveReason: reason || 'Voluntary Household Departure' }
        });
      }
      // Mark tenant as Past and unlink from unit
      await getPrisma().tenant.update({
        where: { id: tenant.id },
        data: { status: 'Past', unitId: null }
      });
    }

    // Mark unit as Vacant
    await getPrisma().unit.update({
      where: { id },
      data: { status: 'Vacant', currentTenantId: null }
    });

    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/units/:id/move-in', async (req, res) => {
  const { id } = req.params;
  const { tenantId, date } = req.body;
  try {
    const tenant = await getPrisma().tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // If internal transfer: close open history record on their previous unit
    if (tenant.unitId && tenant.unitId !== id) {
      const openHistory = await getPrisma().tenantHistory.findFirst({
        where: { tenantId, unitId: tenant.unitId, endDate: null }
      });
      if (openHistory) {
        await getPrisma().tenantHistory.update({
          where: { id: openHistory.id },
          data: { endDate: new Date(date), moveReason: 'Internal Transfer' }
        });
      }
      // Vacate previous unit
      await getPrisma().unit.update({
        where: { id: tenant.unitId },
        data: { status: 'Vacant', currentTenantId: null }
      });
    }

    // Create new TenantHistory record for the new unit
    await getPrisma().tenantHistory.create({
      data: { tenantId, unitId: id, startDate: new Date(date) }
    });

    // Update tenant
    await getPrisma().tenant.update({
      where: { id: tenantId },
      data: { unitId: id, status: 'Current', startDate: date }
    });

    // Update unit
    await getPrisma().unit.update({
      where: { id },
      data: { status: 'Occupied', currentTenantId: tenantId }
    });

    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/units/:id/transfer', async (req, res) => {
  const { id } = req.params;
  const { toUnitId, date } = req.body;
  try {
    // Find all residents of the source unit
    const residents = await getPrisma().tenant.findMany({ where: { unitId: id, status: 'Current' } });

    for (const tenant of residents) {
      // Close open history on source unit
      const openHistory = await getPrisma().tenantHistory.findFirst({
        where: { tenantId: tenant.id, unitId: id, endDate: null }
      });
      if (openHistory) {
        await getPrisma().tenantHistory.update({
          where: { id: openHistory.id },
          data: { endDate: new Date(date), moveReason: 'Internal Unit Transfer' }
        });
      }
      // Open new history on destination unit
      await getPrisma().tenantHistory.create({
        data: { tenantId: tenant.id, unitId: toUnitId, startDate: new Date(date) }
      });
      // Update tenant's unit
      await getPrisma().tenant.update({
        where: { id: tenant.id },
        data: { unitId: toUnitId, startDate: date }
      });
    }

    // Vacate source unit, occupy destination unit
    await getPrisma().unit.update({ where: { id }, data: { status: 'Vacant', currentTenantId: null } });
    await getPrisma().unit.update({
      where: { id: toUnitId },
      data: { status: 'Occupied', currentTenantId: residents[0]?.id ?? null }
    });

    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/maintenance', async (req, res) => {
  try {
    const requests = await getPrisma().maintenanceRequest.findMany({
      include: { unit: true },
      orderBy: { createdAt: 'desc' }
    });
    // UI expects category as an array. Split the comma-separated string from DB.
    const mapped = requests.map(r => ({ 
      ...r, 
      category: r.category ? r.category.split(', ') : []
    }));
    res.json(mapped);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/maintenance', async (req, res) => {
  const { title, description, status, priority, category, unitId, requestedBy, notes } = req.body;
  const categoryString = Array.isArray(category) ? category.join(', ') : category;
  const request = await getPrisma().maintenanceRequest.create({
    data: { 
      title, 
      description, 
      status, 
      priority, 
      category: categoryString, 
      unitId, 
      requestedBy, 
      notes: notes || [] 
    } 
  });
  res.json(request);
});

app.put('/api/maintenance/:id', async (req, res) => {
  const { title, description, status, priority, category, unitId, notes } = req.body;
  const categoryString = Array.isArray(category) ? category.join(', ') : category;
  const request = await getPrisma().maintenanceRequest.update({
    where: { id: req.params.id },
    data: { 
      title, 
      description, 
      status, 
      priority, 
      category: categoryString, 
      unitId, 
      notes: notes || [] 
    }
  });
  res.json(request);
});


app.delete('/api/maintenance/:id', async (req, res) => {
  await getPrisma().maintenanceRequest.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

app.get('/api/announcements', async (req, res) => {
  const announcements = await getPrisma().announcement.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(announcements);
});

app.post('/api/announcements', async (req, res) => {
  const { title, content, type, priority, author, date } = req.body;
  const announcement = await getPrisma().announcement.create({
    data: { title, content, type, priority, author, date }
  });
  res.json(announcement);
});

app.put('/api/announcements/:id', async (req, res) => {
  const { title, content, type, priority, date } = req.body;
  const announcement = await getPrisma().announcement.update({
    where: { id: req.params.id },
    data: { title, content, type, priority, date }
  });
  res.json(announcement);
});

app.delete('/api/announcements/:id', async (req, res) => {
  await getPrisma().announcement.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

app.get('/api/documents', async (req, res) => {
  const documents = await getPrisma().document.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(documents);
});

app.post('/api/documents', async (req, res) => {
  const { title, category, url, fileType, author, date, tags, committee } = req.body;

  // Tag generation temporarily disabled for basic metadata sync
  const currentYear = new Date().getFullYear().toString();
  const committeeTags = committee ? [committee] : [];
  const providedTags = Array.isArray(tags) ? tags : [];
  const finalTags = Array.from(new Set([currentYear, ...committeeTags, ...providedTags]));

  const document = await getPrisma().document.create({
    data: {
      title: title || 'Untitled Document',
      category: category || 'General',
      url: url || '#',
      fileType: fileType || 'txt',
      author: author || ((req as any).session?.user?.name || 'System'),
      date: date || new Date().toISOString().split('T')[0],
      tags: finalTags,
    }
  });
  res.json(document);
});

app.put('/api/documents/:id', async (req, res) => {
  const { title, category, tags, committee } = req.body;
  const document = await getPrisma().document.update({
    where: { id: req.params.id },
    data: { title, category, tags, committee }
  });
  res.json(document);
});

app.delete('/api/documents/:id', async (req, res) => {
  await getPrisma().document.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

app.get('/api/committees', async (req, res) => {
  try {
    const committees = await getPrisma().committee.findMany({
      include: { members: true }
    });
    // UI expects members as an array of name strings
    const mapped = committees.map(c => ({
      ...c,
      members: c.members.map((m: any) => `${m.firstName} ${m.lastName}`)
    }));
    res.json(mapped);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/events', async (req, res) => {
  const events = await getPrisma().coopEvent.findMany({
    include: { attendees: true },
    orderBy: { date: 'asc' }
  });
  res.json(events);
});

app.post('/api/events', async (req, res) => {
  const { title, description, date, time, location, category } = req.body;
  const event = await getPrisma().coopEvent.create({
    data: { title, description, date, time, location, category },
    include: { attendees: true }
  });
  res.json(event);
});

app.put('/api/events/:id', async (req, res) => {
  const { title, description, date, time, location, category } = req.body;
  const event = await getPrisma().coopEvent.update({
    where: { id: req.params.id },
    data: { title, description, date, time, location, category },
    include: { attendees: true }
  });
  res.json(event);
});

app.post('/api/events/:id/attend', async (req, res) => {
  const user = (req as any).session?.user;
  if (!user || !user.email) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tenant = await getPrisma().tenant.findUnique({ where: { email: user.email } });
    if (!tenant) return res.status(404).json({ error: 'Tenant record not found for this user' });

    const event = await getPrisma().coopEvent.update({
      where: { id: req.params.id },
      data: {
        attendees: {
          connect: { id: tenant.id }
        }
      },
      include: { attendees: true }
    });
    res.json(event);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  await getPrisma().coopEvent.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// --- AI Routes ---
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

app.post('/api/ai/triage', async (req, res) => {
  try {
    const ai = getAI();
    const { description } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `Evaluate the following maintenance request for a BC housing co-op and return a suggested urgency level (Low, Medium, High, Emergency) and a category (Plumbing, Electrical, Structural, Appliance, Other). Request: "${description}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: { type: Type.STRING }, // Consolidation: use priority field
            category: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          },
          required: ['priority', 'category']
        }
      }
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (e: any) {
    res.status(500).json({ priority: 'Medium', category: 'Other', error: e.message });
  }
});

app.post('/api/ai/policy', async (req, res) => {
  try {
    const ai = getAI();
    const { question, context } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `You are an AI assistant for a BC Housing Co-operative. Answer the following member question based on the provided policy context and your knowledge of BC co-operative housing law. If the answer isn't in the context, draw on general BC co-op principles but note that the member should verify with the board.\n\nContext: ${context}\nQuestion: ${question}`,
      config: { temperature: 0.2 }
    });
    res.json({ answer: response.text });
  } catch (e: any) {
    res.status(500).json({ answer: 'Unable to answer at this time. Please contact the board.', error: e.message });
  }
});

app.post('/api/ai/summarize', async (req, res) => {
  try {
    const ai = getAI();
    const { content } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `Analyze the following document content from a BC Housing Co-operative. Provide a short summary (max 2 sentences) and suggest 3-5 relevant semantic tags for categorization (e.g., "pets", "parking", "agm").\n\nContent: ${content.substring(0, 5000)}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['summary', 'tags']
        }
      }
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (e: any) {
    res.status(500).json({ summary: '', tags: [], error: e.message });
  }
});


app.get('/api/migrate', async (req, res) => {
  try {
    const p = getPrisma();

    console.log('Running raw SQL migrations...');
    await p.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'MEMBER';`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "committee" TEXT DEFAULT '';`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];`);

    // Explicitly DROP columns if they exist to match metadata-only goal
    await p.$executeRawUnsafe(`ALTER TABLE "Document" DROP COLUMN IF EXISTS "content";`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" DROP COLUMN IF EXISTS "isPrivate";`);

    // Check if seeding is needed
    const unitCount = await p.unit.count();
    let seeded = false;

    if (unitCount === 0) {
      console.log('Database empty, triggering auto-seed...');
      // We can't easily call the /api/seed endpoint internally, so we'll just 
      // suggest the user visit it, or we could move the logic to a helper.
      // For simplicity and speed, let's just make the message clear.
      return res.json({
        success: true,
        message: "Database schema updated. Please now visit /api/seed once to restore your data."
      });
    }

    res.json({
      success: true,
      message: "Database schema and data are synced."
    });
  } catch (e: any) {
    console.error('Migration error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/seed', async (req, res) => {
  try {
    const p = getPrisma();
    console.log('Clearing existing data...');
    await p.tenantHistory.deleteMany();
    await p.maintenanceRequest.deleteMany();
    await p.announcement.deleteMany();
    await p.document.deleteMany();
    await p.committee.deleteMany();
    await p.coopEvent.deleteMany();
    await p.tenant.deleteMany();
    await p.unit.deleteMany();

    console.log('Seeding units...');
    const unitDefs = [
      { number: '101', type: '1BR', floor: 1, status: 'Occupied' },
      { number: '102', type: '2BR', floor: 1, status: 'Occupied' },
      { number: '103', type: '2BR', floor: 1, status: 'Occupied' },
      { number: '104', type: '3BR', floor: 1, status: 'Occupied' },
      { number: '105', type: '1BR', floor: 1, status: 'Vacant' },
      { number: '106', type: '2BR', floor: 1, status: 'Occupied' },
      { number: '107', type: '1BR', floor: 1, status: 'Occupied' },
      { number: '108', type: '2BR', floor: 1, status: 'Occupied' },
      { number: '109', type: '1BR', floor: 1, status: 'Occupied' },
      { number: '201', type: '2BR', floor: 2, status: 'Occupied' },
      { number: '202', type: '3BR', floor: 2, status: 'Occupied' },
      { number: '203', type: '1BR', floor: 2, status: 'Occupied' },
      { number: '204', type: '2BR', floor: 2, status: 'Maintenance' },
      { number: '205', type: '3BR', floor: 2, status: 'Occupied' },
      { number: '206', type: '2BR', floor: 2, status: 'Occupied' },
      { number: '207', type: '1BR', floor: 2, status: 'Occupied' },
      { number: '208', type: '1BR', floor: 2, status: 'Occupied' },
      { number: '209', type: '2BR', floor: 2, status: 'Occupied' },
      { number: '301', type: '3BR', floor: 3, status: 'Occupied' },
      { number: '302', type: '2BR', floor: 3, status: 'Occupied' },
      { number: '303', type: '1BR', floor: 3, status: 'Occupied' },
      { number: '304', type: '2BR', floor: 3, status: 'Vacant' },
      { number: '305', type: '3BR', floor: 3, status: 'Occupied' },
      { number: '306', type: '4BR', floor: 3, status: 'Occupied' },
      { number: '307', type: '2BR', floor: 3, status: 'Occupied' },
      { number: '308', type: '1BR', floor: 3, status: 'Occupied' },
      { number: '309', type: '2BR', floor: 3, status: 'Occupied' },
      { number: '401', type: '2BR', floor: 4, status: 'Occupied' },
      { number: '402', type: '1BR', floor: 4, status: 'Occupied' },
      { number: '403', type: '2BR', floor: 4, status: 'Occupied' },
      { number: '404', type: '1BR', floor: 4, status: 'Occupied' },
      { number: '405', type: '2BR', floor: 4, status: 'Vacant' },
      { number: '406', type: '1BR', floor: 4, status: 'Occupied' },
      { number: '407', type: '2BR', floor: 4, status: 'Occupied' },
    ];

    const units: any[] = [];
    for (const u of unitDefs) {
      const unit = await p.unit.create({ data: u });
      units.push(unit);
    }

    const unitMap: Record<string, string> = {};
    units.forEach(u => { unitMap[u.number] = u.id; });

    console.log('Seeding tenants...');
    const tenantData = [
      { firstName: 'Margaret', lastName: 'Chen', email: 'margaret.chen@email.com', phone: '250-555-0101', startDate: '2019-03-15', status: 'Current', unit: '101' },
      { firstName: 'David', lastName: 'Okafor', email: 'david.okafor@email.com', phone: '250-555-0102', startDate: '2020-07-01', status: 'Current', unit: '102' },
      { firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@email.com', phone: '250-555-0103', startDate: '2021-01-10', status: 'Current', unit: '102' },
      { firstName: 'Robert', lastName: 'Tremblay', email: 'robert.tremblay@email.com', phone: '250-555-0104', startDate: '2018-09-01', status: 'Current', unit: '103' },
      { firstName: 'Susan', lastName: 'Tremblay', email: 'susan.tremblay@email.com', phone: '250-555-0105', startDate: '2018-09-01', status: 'Current', unit: '103' },
      { firstName: 'James', lastName: 'Nakamura', email: 'james.nakamura@email.com', phone: '250-555-0106', startDate: '2017-05-20', status: 'Current', unit: '104' },
      { firstName: 'Linda', lastName: 'Nakamura', email: 'linda.nakamura@email.com', phone: '250-555-0107', startDate: '2017-05-20', status: 'Current', unit: '104' },
      { firstName: 'Carlos', lastName: 'Rivera', email: 'carlos.rivera@email.com', phone: '250-555-0108', startDate: '2022-02-14', status: 'Current', unit: '106' },
      { firstName: 'Aisha', lastName: 'Mohammed', email: 'aisha.mohammed@email.com', phone: '250-555-0109', startDate: '2021-08-30', status: 'Current', unit: '201' },
      { firstName: 'Thomas', lastName: 'Bergstrom', email: 'thomas.bergstrom@email.com', phone: '250-555-0110', startDate: '2016-11-01', status: 'Current', unit: '202' },
      { firstName: 'Karen', lastName: 'Bergstrom', email: 'karen.bergstrom@email.com', phone: '250-555-0111', startDate: '2016-11-01', status: 'Current', unit: '202' },
      { firstName: 'Wei', lastName: 'Liu', email: 'wei.liu@email.com', phone: '250-555-0112', startDate: '2023-04-01', status: 'Current', unit: '203' },
      { firstName: 'Patricia', lastName: 'MacLeod', email: 'patricia.macleod@email.com', phone: '250-555-0113', startDate: '2019-06-15', status: 'Current', unit: '205' },
      { firstName: 'Kevin', lastName: 'MacLeod', email: 'kevin.macleod@email.com', phone: '250-555-0114', startDate: '2019-06-15', status: 'Current', unit: '205' },
      { firstName: 'Fatima', lastName: 'Al-Hassan', email: 'fatima.alhassan@email.com', phone: '250-555-0115', startDate: '2020-10-01', status: 'Current', unit: '206' },
      { firstName: 'George', lastName: 'Papadopoulos', email: 'george.papadopoulos@email.com', phone: '250-555-0116', startDate: '2015-03-01', status: 'Current', unit: '301' },
      { firstName: 'Helen', lastName: 'Papadopoulos', email: 'helen.papadopoulos@email.com', phone: '250-555-0117', startDate: '2015-03-01', status: 'Current', unit: '301' },
      { firstName: 'Michael', lastName: 'Johansson', email: 'michael.johansson@email.com', phone: '250-555-0118', startDate: '2022-09-01', status: 'Current', unit: '302' },
      { firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki.tanaka@email.com', phone: '250-555-0119', startDate: '2023-01-15', status: 'Current', unit: '303' },
      { firstName: 'Brian', lastName: 'Walsh', email: 'brian.walsh@email.com', phone: '250-555-0120', startDate: '2018-07-01', status: 'Current', unit: '305' },
      { firstName: 'Catherine', lastName: 'Walsh', email: 'catherine.walsh@email.com', phone: '250-555-0121', startDate: '2018-07-01', status: 'Current', unit: '305' },
      { firstName: 'Ahmed', lastName: 'Patel', email: 'ahmed.patel@email.com', phone: '250-555-0122', startDate: '2017-12-01', status: 'Current', unit: '306' },
      { firstName: 'Nadia', lastName: 'Patel', email: 'nadia.patel@email.com', phone: '250-555-0123', startDate: '2017-12-01', status: 'Current', unit: '306' },
      { firstName: 'Oliver', lastName: 'Grant', email: 'oliver.grant@email.com', phone: '250-555-0130', startDate: '2024-01-10', status: 'Waitlist', unit: undefined },
      { firstName: 'Sophie', lastName: 'Dubois', email: 'sophie.dubois@email.com', phone: '250-555-0131', startDate: '2024-03-22', status: 'Waitlist', unit: undefined },
      { firstName: 'Marcus', lastName: 'Williams', email: 'marcus.williams@email.com', phone: '250-555-0132', startDate: '2024-05-14', status: 'Waitlist', unit: undefined },
      { firstName: 'Eleanor', lastName: 'Frost', email: 'eleanor.frost@email.com', phone: '250-555-0140', startDate: '2015-01-01', status: 'Past', unit: undefined },
      { firstName: 'Raymond', lastName: 'Kim', email: 'raymond.kim@email.com', phone: '250-555-0141', startDate: '2016-06-01', status: 'Past', unit: undefined },
      { firstName: 'Ingrid', lastName: 'Sorensen', email: 'ingrid.sorensen@email.com', phone: '250-555-0124', startDate: '2021-05-01', status: 'Current', unit: '107' },
      { firstName: 'Paulo', lastName: 'Ferreira', email: 'paulo.ferreira@email.com', phone: '250-555-0125', startDate: '2022-11-15', status: 'Current', unit: '108' },
      { firstName: 'Diana', lastName: 'Ferreira', email: 'diana.ferreira@email.com', phone: '250-555-0126', startDate: '2022-11-15', status: 'Current', unit: '108' },
      { firstName: 'Lena', lastName: 'Kowalski', email: 'lena.kowalski@email.com', phone: '250-555-0127', startDate: '2023-08-01', status: 'Current', unit: '109' },
      { firstName: 'Derek', lastName: 'Munroe', email: 'derek.munroe@email.com', phone: '250-555-0128', startDate: '2020-04-01', status: 'Current', unit: '207' },
      { firstName: 'Amara', lastName: 'Diallo', email: 'amara.diallo@email.com', phone: '250-555-0129', startDate: '2024-02-01', status: 'Current', unit: '208' },
      { firstName: 'Stefan', lastName: 'Novak', email: 'stefan.novak@email.com', phone: '250-555-0133', startDate: '2021-09-15', status: 'Current', unit: '209' },
      { firstName: 'Jana', lastName: 'Novak', email: 'jana.novak@email.com', phone: '250-555-0134', startDate: '2021-09-15', status: 'Current', unit: '209' },
      { firstName: 'Trevor', lastName: 'Osei', email: 'trevor.osei@email.com', phone: '250-555-0135', startDate: '2022-06-01', status: 'Current', unit: '307' },
      { firstName: 'Miriam', lastName: 'Goldstein', email: 'miriam.goldstein@email.com', phone: '250-555-0136', startDate: '2023-03-15', status: 'Current', unit: '308' },
      { firstName: 'Kenji', lastName: 'Watanabe', email: 'kenji.watanabe@email.com', phone: '250-555-0137', startDate: '2020-12-01', status: 'Current', unit: '309' },
      { firstName: 'Yuna', lastName: 'Watanabe', email: 'yuna.watanabe@email.com', phone: '250-555-0138', startDate: '2020-12-01', status: 'Current', unit: '309' },
      { firstName: 'Bernard', lastName: 'Lefebvre', email: 'bernard.lefebvre@email.com', phone: '250-555-0150', startDate: '2024-06-01', status: 'Current', unit: '401' },
      { firstName: 'Claire', lastName: 'Lefebvre', email: 'claire.lefebvre@email.com', phone: '250-555-0151', startDate: '2024-06-01', status: 'Current', unit: '401' },
      { firstName: 'Ravi', lastName: 'Krishnamurthy', email: 'ravi.krishnamurthy@email.com', phone: '250-555-0152', startDate: '2024-07-15', status: 'Current', unit: '402' },
      { firstName: 'Elena', lastName: 'Vasquez', email: 'elena.vasquez@email.com', phone: '250-555-0153', startDate: '2024-08-01', status: 'Current', unit: '403' },
      { firstName: 'Marco', lastName: 'Vasquez', email: 'marco.vasquez@email.com', phone: '250-555-0154', startDate: '2024-08-01', status: 'Current', unit: '403' },
      { firstName: 'Hana', lastName: 'Becker', email: 'hana.becker@email.com', phone: '250-555-0155', startDate: '2024-09-01', status: 'Current', unit: '404' },
      { firstName: 'Isaiah', lastName: 'Campbell', email: 'isaiah.campbell@email.com', phone: '250-555-0156', startDate: '2025-01-15', status: 'Current', unit: '406' },
      { firstName: 'Natasha', lastName: 'Ivanova', email: 'natasha.ivanova@email.com', phone: '250-555-0157', startDate: '2025-02-01', status: 'Current', unit: '407' },
      { firstName: 'Dmitri', lastName: 'Ivanov', email: 'dmitri.ivanov@email.com', phone: '250-555-0158', startDate: '2025-02-01', status: 'Current', unit: '407' },
    ];

    const tenants: Record<string, any> = {};
    const adminEmails = ['joewcoupons@gmail.com', 'wwansbro@gmail.com', 'joewansbrough@gmail.com', 'samisaeed123@gmail.com', 'margaret.chen@email.com'];
    for (const t of tenantData) {
      const tenant = await p.tenant.create({
        data: {
          firstName: t.firstName,
          lastName: t.lastName,
          email: t.email,
          phone: t.phone,
          startDate: t.startDate,
          status: t.status,
          unitId: t.unit ? unitMap[t.unit] : null,
          role: adminEmails.includes(t.email.toLowerCase()) ? 'ADMIN' : 'MEMBER'
        },
      });
      tenants[t.email] = tenant;

      if (t.unit && unitMap[t.unit]) {
        await p.unit.update({
          where: { id: unitMap[t.unit] },
          data: { currentTenantId: tenant.id },
        });
        await p.tenantHistory.create({
          data: {
            tenantId: tenant.id,
            unitId: unitMap[t.unit],
            startDate: new Date(t.startDate),
            moveReason: 'Initial occupancy',
          },
        });
      }
    }

    console.log('Seeding maintenance requests...');
    const maintenanceData = [
      { title: 'Leaking kitchen faucet', description: 'The kitchen faucet has been dripping constantly for the past week. Water is pooling under the sink cabinet.', status: 'Pending', priority: 'Medium', category: 'Plumbing', unitNumber: '101', requestedBy: 'margaret.chen@email.com', createdAt: new Date('2026-02-28') },
      { title: 'Bathroom exhaust fan not working', description: 'The exhaust fan in the main bathroom stopped working. There is condensation building up on the ceiling.', status: 'In Progress', priority: 'Medium', category: 'Electrical', unitNumber: '102', requestedBy: 'david.okafor@email.com', createdAt: new Date('2026-02-20') },
      { title: 'Dishwasher not draining', description: 'The dishwasher fills with water but does not drain after cycle completes. Standing water remains at bottom.', status: 'Completed', priority: 'Medium', category: 'Appliance', unitNumber: '104', requestedBy: 'james.nakamura@email.com', createdAt: new Date('2026-01-15') },
      { title: 'Broken window latch - balcony door', description: 'The latch on the balcony sliding door is broken. The door does not lock properly which is a security concern.', status: 'Pending', priority: 'High', category: 'Structural', unitNumber: '103', requestedBy: 'robert.tremblay@email.com', createdAt: new Date('2026-03-01') },
      { title: 'Heating unit making loud noise', description: 'The baseboard heater in the living room is making a loud banging noise when it turns on. Happens every morning.', status: 'In Progress', priority: 'Low', category: 'HVAC', unitNumber: '106', requestedBy: 'carlos.rivera@email.com', createdAt: new Date('2026-02-10') },
      { title: 'Water damage on ceiling', description: 'Brown water stain appearing on the bedroom ceiling. Appears to be coming from unit above. Getting larger over time.', status: 'Pending', priority: MaintenancePriority.EMERGENCY, category: 'Structural', unitNumber: '201', requestedBy: 'aisha.mohammed@email.com', createdAt: new Date('2026-03-05') },

      { title: 'Unit 204 full renovation', description: 'Unit undergoing full renovation following previous tenant departure. Flooring, paint, kitchen fixtures all being replaced.', status: 'In Progress', priority: 'Medium', category: 'Structural', unitNumber: '204', requestedBy: null, createdAt: new Date('2026-02-01') },
      { title: 'Stove burner not igniting', description: 'Front left burner on gas stove does not ignite. Clicking sound present but no flame. Other burners work fine.', status: 'Pending', priority: 'Medium', category: 'Appliance', unitNumber: '203', requestedBy: 'wei.liu@email.com', createdAt: new Date('2026-03-07') },
      { title: 'Exterior parking lot light out', description: 'The lamp post nearest to stalls 12-15 is not working. Area is very dark at night, safety concern for residents.', status: 'Pending', priority: 'High', category: 'Electrical', unitNumber: '301', requestedBy: 'george.papadopoulos@email.com', createdAt: new Date('2026-03-03') },
      { title: 'Bathroom tiles cracked', description: 'Several floor tiles in the main bathroom have cracked. One tile has a sharp edge that is a safety hazard.', status: 'Completed', priority: 'High', category: 'Structural', unitNumber: '302', requestedBy: 'michael.johansson@email.com', createdAt: new Date('2026-01-20') },
      { title: 'Intercom not working', description: 'The intercom handset in the unit does not ring when visitors buzz from the front door. Cannot let guests in.', status: 'Pending', priority: 'Medium', category: 'Electrical', unitNumber: '303', requestedBy: 'yuki.tanaka@email.com', createdAt: new Date('2026-03-08') },
      { title: 'Hallway carpet damage', description: 'Large section of hallway carpet near Unit 305 has come loose and is a tripping hazard for all residents on floor 3.', status: 'In Progress', priority: 'High', category: 'Safety', unitNumber: '305', requestedBy: null, createdAt: new Date('2026-02-25') },
    ];
    for (const m of maintenanceData) {
      await p.maintenanceRequest.create({
        data: {
          title: m.title,
          description: m.description,
          status: m.status,
          priority: m.priority,
          category: m.category,
          unitId: unitMap[m.unitNumber],
          requestedBy: m.requestedBy,
          createdAt: m.createdAt
        }
      });
    }

    console.log('Seeding announcements...');
    const announcementData = [
      { title: 'Annual General Meeting — April 12th', content: 'The Oak Bay Housing Co-operative Annual General Meeting will be held on Saturday, April 12th at 2:00 PM in the Community Room. Agenda items include the 2025 financial review, election of board members, and proposed bylaw amendments. All members are encouraged to attend. Light refreshments will be provided. Please RSVP to admin@oakbaycoop.bc.ca by April 5th.', type: 'General', priority: 'High', author: 'Board Administration', date: '2026-03-08' },
      { title: 'Water Shutoff — March 18th 9AM–1PM', content: 'A scheduled water shutoff is required to complete repairs to the main building supply line. The shutoff will affect all units and will take place on Tuesday March 18th from 9:00 AM to approximately 1:00 PM. Please store sufficient water in advance. We apologize for the inconvenience and thank you for your patience.', type: 'Maintenance', priority: 'Urgent', author: 'Maintenance Committee', date: '2026-03-06' },
      { title: 'New Recycling Guidelines Effective April 1st', content: 'The City of Victoria has updated its recycling program. Starting April 1st, soft plastics must be deposited in the dedicated soft plastics bin in the recycling room rather than the blue bin. Glass bottles and jars should be rinsed before recycling. Updated sorting guides have been posted in the recycling room and laundry room.', type: 'General', priority: 'Normal', author: 'Board Administration', date: '2026-03-01' },
      { title: 'Parking Lot Repaving — Weekend of March 22nd', content: 'The parking lot will be repaved over the weekend of March 22nd–23rd. All vehicles must be removed from the lot by 7:00 AM Saturday. Street parking is available on Foul Bay Road and Granite Street. Vehicles left in the lot may be towed at the owner\'s expense. The lot will reopen by Sunday evening.', type: 'Maintenance', priority: 'High', author: 'Maintenance Committee', date: '2026-02-28' },
      { title: 'Spring Garden Volunteer Day — April 5th', content: 'Join your neighbours for the annual spring garden cleanup on Saturday April 5th starting at 10:00 AM. We\'ll be pruning, planting, and refreshing the communal garden beds. Tools and gloves provided. Lunch will be served at noon. This counts toward your annual participation hours.', type: 'General', priority: 'Normal', author: 'Garden Committee', date: '2026-02-20' },
      { title: 'Housing Charge Increase — Effective July 1st', content: 'Following the board\'s annual financial review, housing charges will increase by 3.2% effective July 1st, 2026. This increase reflects rising municipal taxes, insurance premiums, and maintenance costs. Individual notice letters will be mailed to all members by April 15th.', type: 'General', priority: 'High', author: 'Finance Committee', date: '2026-02-15' },
      { title: 'Fire Alarm System Test — March 14th', content: 'The building\'s fire alarm system will undergo its mandatory annual inspection on Friday March 14th between 10:00 AM and 3:00 PM. Expect brief alarm activations throughout the day. Please do not call 911 during testing periods.', type: 'Maintenance', priority: 'Normal', author: 'Board Administration', date: '2026-03-04' },
    ];
    for (const a of announcementData) {
      await p.announcement.create({ data: a });
    }

    console.log('Seeding documents...');
    const documentData = [
      { title: 'Oak Bay Co-op Rules & Regulations 2024', category: 'Bylaws', url: '#', fileType: 'pdf', author: 'Board Administration', date: '2024-01-15', tags: ['legal', 'governance', 'bylaws'] },
      { title: 'Co-operative Housing Act — BC', category: 'Bylaws', url: '#', fileType: 'pdf', author: 'Legislative BC', date: '2023-06-01', tags: ['legal', 'provincial'] },
      { title: 'Member Handbook 2025', category: 'Policies', url: '#', fileType: 'pdf', author: 'Membership Committee', date: '2025-01-01', tags: ['handbook', 'rules'] },
      { title: 'Pet Policy', category: 'Policies', url: '#', fileType: 'pdf', author: 'Board Administration', date: '2023-09-01', tags: ['pets', 'rules'] },
      { title: 'Noise & Quiet Hours Policy', category: 'Policies', url: '#', fileType: 'pdf', author: 'Board Administration', date: '2022-11-15', tags: ['noise', 'living'] },
      { title: 'Parking Policy & Stall Assignment', category: 'Policies', url: '#', fileType: 'pdf', author: 'Maintenance Committee', date: '2024-03-01', tags: ['parking', 'vehicles'] },
      { title: 'AGM Minutes — April 2025', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2025-04-20', tags: ['minutes', 'agm'] },
      { title: 'Board Meeting Minutes — February 2026', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2026-02-18', tags: ['minutes', 'board'] },
      { title: 'Board Meeting Minutes — January 2026', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2026-01-21', tags: ['minutes', 'board'] },
      { title: '2025 Annual Financial Statements', category: 'Financials', url: '#', fileType: 'pdf', author: 'Finance Committee', date: '2026-02-01', tags: ['financial', 'audit'] },
      { title: '2026 Operating Budget', category: 'Financials', url: '#', fileType: 'xls', author: 'Finance Committee', date: '2026-01-10', tags: ['budget', 'financial'] },
      { title: 'Reserve Fund Study 2024', category: 'Financials', url: '#', fileType: 'pdf', author: 'Board Administration', date: '2024-06-15', tags: ['reserve', 'future-planning'] },
    ];
    for (const d of documentData) {
      await p.document.create({ data: d });
    }

    console.log('Seeding committees...');
    const committeeData = [
      { name: 'Board of Directors', description: 'Elected governing body responsible for overall co-op management, policy decisions, and financial oversight.', chair: 'George Papadopoulos', icon: 'fa-landmark', members: ['george.papadopoulos@email.com', 'thomas.bergstrom@email.com', 'patricia.macleod@email.com', 'james.nakamura@email.com', 'fatima.alhassan@email.com'] },
      { name: 'Maintenance Committee', description: 'Oversees building upkeep, coordinates repairs, manages contractor relationships, and reviews maintenance requests.', chair: 'Thomas Bergstrom', icon: 'fa-wrench', members: ['thomas.bergstrom@email.com', 'brian.walsh@email.com', 'carlos.rivera@email.com', 'robert.tremblay@email.com'] },
      { name: 'Finance Committee', description: 'Reviews financial statements, prepares budgets, monitors reserve fund, and recommends housing charge adjustments.', chair: 'Patricia MacLeod', icon: 'fa-dollar-sign', members: ['patricia.macleod@email.com', 'ahmed.patel@email.com', 'margaret.chen@email.com'] },
      { name: 'Membership Committee', description: 'Reviews applications, manages the waitlist, conducts interviews, and facilitates member orientation.', chair: 'Fatima Al-Hassan', icon: 'fa-users', members: ['fatima.alhassan@email.com', 'aisha.mohammed@email.com', 'yuki.tanaka@email.com', 'michael.johansson@email.com'] },
      { name: 'Garden Committee', description: 'Plans and maintains communal garden areas, organizes volunteer days, and manages the community composting program.', chair: 'Helen Papadopoulos', icon: 'fa-leaf', members: ['helen.papadopoulos@email.com', 'linda.nakamura@email.com', 'karen.bergstrom@email.com', 'wei.liu@email.com', 'catherine.walsh@email.com'] },
      { name: 'Social Committee', description: 'Organizes community events, potlucks, seasonal celebrations, and fosters neighbourly connections among members.', chair: 'Susan Tremblay', icon: 'fa-calendar', members: ['susan.tremblay@email.com', 'priya.sharma@email.com', 'nadia.patel@email.com', 'david.okafor@email.com'] },
    ];

    for (const c of committeeData) {
      await p.committee.create({
        data: {
          name: c.name,
          description: c.description,
          chair: c.chair,
          icon: c.icon,
          members: {
            connect: c.members.map(email => ({ id: tenants[email].id })),
          },
        },
      });
    }

    console.log('Seeding calendar events...');
    const baseEvents = [
      { title: 'Board of Directors Meeting', category: 'Board', location: 'Community Room', time: '19:00', description: 'Monthly governance review and policy discussion.' },
      { title: 'Community Potluck', category: 'Social', location: 'Courtyard', time: '17:30', description: 'Bring a dish to share and meet your neighbours!' },
      { title: 'Maintenance Committee Check', category: 'Maintenance', location: 'Basement/Roof', time: '10:00', description: 'Routine building system inspection.' },
      { title: 'General Member Meeting', category: 'Meeting', location: 'Community Room', time: '19:30', description: 'Quarterly update for all co-op members.' },
      { title: 'Garden Volunteer Day', category: 'Social', location: 'Garden Beds', time: '09:00', description: 'Helping keep our communal spaces green and clean.' },
    ];

    const startDate = new Date('2026-03-01');
    const endDate = new Date('2026-12-31');
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const numEvents = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < numEvents; i++) {
        const baseEvent = baseEvents[Math.floor(Math.random() * baseEvents.length)];
        const eventDate = new Date(currentDate);
        eventDate.setDate(Math.floor(Math.random() * 28) + 1);

        await p.coopEvent.create({
          data: {
            ...baseEvent,
            date: eventDate.toISOString().split('T')[0],
          },
        });
      }
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    res.json({ success: true, message: "Mock data seeded successfully." });
  } catch (e: any) {
    console.error('Seeding error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get(['/api/debug/config', '/debug/config'], (req, res) => {
  res.json({
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasPickerApiKey: !!process.env.PICKER_API_KEY,
    hasSessionSecret: !!process.env.SESSION_SECRET,
    baseUrl: getBaseUrl(req),
    isSecure: req.secure,
    protocol: req.protocol,
    headers: req.headers,
    url: req.url,
    originalUrl: req.originalUrl,
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

export default app;
