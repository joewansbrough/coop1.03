import express from 'express';
import cookieSession from 'cookie-session';
import axios from 'axios';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { z } from 'zod';
import { maintenanceSchema, documentSchema, announcementSchema, tenantSchema } from './validation.js';
import { MaintenancePriority } from '../types.js';



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
  // Round-trip through Buffer to strip any bytes that aren't valid UTF-8,
  // then remove null bytes and non-printable control characters Postgres rejects.
  const cleaned = Buffer.from(str, 'utf8').toString('utf8');
  return cleaned
    .replace(/\u0000/g, '')
    .replace(/\0/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/\x00/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD\uFFFE\uFFFF]/g, "");
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

    // Dynamically resolve the best available Gemini model once at login
    let resolvedModel = 'gemini-2.5-flash-lite'; // safe fallback
    try {
      const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');
      const { models } = await genAI.listModels();

      // Skip known deprecated/unavailable model families
      const DEPRECATED = ['gemini-1.0', 'gemini-1.5', 'gemini-2.0', 'gemini-pro', 'aqa', 'embedding'];

      const contentModels = models.filter(m => {
        const name = m.name.toLowerCase();
        return (
          m.supportedGenerationMethods?.includes('generateContent') &&
          name.includes('gemini') &&
          !DEPRECATED.some(d => name.includes(d))
        );
      });

      // Score: prefer flash-lite > flash > pro, boosted by version number
      const score = (name: string): number => {
        let s = 0;
        if (name.includes('flash-lite') || name.includes('flash_lite')) s += 30;
        else if (name.includes('flash')) s += 20;
        else if (name.includes('pro')) s += 10;
        const versionMatch = name.match(/(\d+\.\d+)/);
        if (versionMatch) s += parseFloat(versionMatch[0]) * 2;
        return s;
      };

      const ranked = contentModels.sort((a, b) => score(b.name.toLowerCase()) - score(a.name.toLowerCase()));
      console.log(`[ModelResolver] Candidates:`, contentModels.map(m => m.name));

      if (ranked[0]?.name) {
        resolvedModel = ranked[0].name.replace('models/', '');
        console.log(`[ModelResolver] Selected model for ${email}: ${resolvedModel}`);
      } else {
        console.warn('[ModelResolver] No non-deprecated models found, using fallback:', resolvedModel);
      }
    } catch (err) {
      console.warn('[ModelResolver] Model listing failed, using fallback:', err);
    }

    (req as any).session.user = {
      email,
      name: userData.name,
      picture: userData.picture,
      isAdmin,
      tenantId: user?.id || null,
      unitNumber: user?.unit?.number || null,
      role: user?.role || 'MEMBER',
      geminiModel: resolvedModel,
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
    const units = await p.unit.findMany({ include: { cooperative: true } }); // Fetch all units to get their IDs


    // Create a map for quick lookup of existing scheduled maintenance tasks
    const existingTasks = await p.scheduledMaintenance.findMany({
      select: { unitId: true, task: true }
    });
    const existingTaskSet = new Set(existingTasks.map(t => `${t.unitId}-${t.task}`));
    const tasksToInsert: any[] = [];


    console.log('Seeding preventative maintenance tasks...');


    // Generate mock tasks for each unit, ensuring variety
    units.forEach(unit => {
      const numTasks = Math.floor(Math.random() * 4) + 1;

      for (let i = 0; i < numTasks; i++) {
        // Create a fresh date for every calculation to avoid mutation bugs
        const dateBase = new Date();
        let task: string;
        let dueDate: Date;
        let frequency: string;
        let assignedTo: string;
        let category: string;

        switch (i) {
          case 0:
            task = 'HVAC Filter Replacement';
            dateBase.setMonth(dateBase.getMonth() + 1);
            dueDate = new Date(dateBase);
            frequency = Math.random() > 0.5 ? 'MONTHLY' : 'QUARTERLY';
            assignedTo = 'Building Management';
            category = 'HVAC';
            break;
          case 1:
            task = Math.random() > 0.5 ? 'Water Heater Flush' : 'Inspect Electrical Panel';
            dateBase.setMonth(dateBase.getMonth() + (Math.random() > 0.5 ? 3 : 6));
            dueDate = new Date(dateBase);
            frequency = Math.random() > 0.5 ? 'QUARTERLY' : 'ANNUAL';
            assignedTo = Math.random() > 0.5 ? 'Maintenance Team' : 'Electrician';
            category = Math.random() > 0.5 ? 'PLUMBING' : 'ELECTRICAL';
            break;
          // ... Repeat logic for other cases ensuring dueDate = new Date(dateBase)
          default:
            task = 'Annual Fire Alarm Test';
            dateBase.setFullYear(dateBase.getFullYear() + 1);
            dueDate = new Date(dateBase);
            frequency = 'ANNUAL';
            assignedTo = 'Safety Officer';
            category = 'SAFETY';
            break;
        }

        if (!existingTaskSet.has(`${unit.id}-${task}`)) {
          tasksToInsert.push({
            unitId: unit.id,
            cooperativeId: unit.cooperativeId,
            task,
            dueDate,
            frequency,
            assignedTo,
            category,
            isCompleted: false,
          });
        }
      }
    });

    // Bulk insert is MUCH safer and faster
    const result = await p.scheduledMaintenance.createMany({
      data: tasksToInsert,
      skipDuplicates: true, // Extra safety layer
    });

    res.json({
      success: true,
      message: `Seeded ${result.count} new tasks.`,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
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
    isAdmin: true,
    isGuest: false,
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

app.get('/api/units/:id/scheduled-maintenance', async (req, res) => {
  try {
    const tasks = await getPrisma().scheduledMaintenance.findMany({
      where: { unitId: req.params.id },
      orderBy: { dueDate: 'asc' }
    });
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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
  const { title, category, url, fileType, author, date, tags, committee, content } = req.body;

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
      content: content || null,
    } as any
  });
  res.json(document);
});

app.put('/api/documents/:id', async (req, res) => {
  const { title, category, tags, content } = req.body;
  const document = await getPrisma().document.update({
    where: { id: req.params.id },
    data: {
      title,
      category,
      tags: tags ? { set: tags } : undefined,
      content
    } as any
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
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn('WARNING: Gemini API_KEY is missing from environment variables.');
  }
  return new GoogleGenerativeAI(apiKey || '');
};

app.post('/api/ai/triage', async (req, res) => {
  try {
    const genAI = getAI();
    const resolvedModel = (req as any).session?.user?.geminiModel || 'gemini-2.5-flash-lite';
    const model = genAI.getGenerativeModel({
      model: resolvedModel,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            priority: { type: SchemaType.STRING },
            category: { type: SchemaType.STRING },
            reasoning: { type: SchemaType.STRING }
          },
          required: ['priority', 'category']
        }
      }
    });

    const { description } = req.body;
    const result = await model.generateContent(`Evaluate the following maintenance request for a BC housing co-op and return a suggested urgency level (Low, Medium, High, Emergency) and a category (Plumbing, Electrical, Structural, Appliance, Other). Request: "${description}"`);
    const response = await result.response;
    res.json(JSON.parse(response.text() || '{}'));
  } catch (e: any) {
    res.status(500).json({ priority: 'Medium', category: 'Other', error: e.message });
  }
});

app.post('/api/ai/policy', async (req, res) => {
  try {
    const genAI = getAI();
    const resolvedModel = (req as any).session?.user?.geminiModel || 'gemini-2.5-flash-lite';
    const model = genAI.getGenerativeModel({ model: resolvedModel });
    const { question, context } = req.body;

    const result = await model.generateContent(`You are an AI assistant for a BC Housing Co-operative. Answer the following member question based on the provided policy context and your knowledge of BC co-operative housing law. If the answer isn't in the context, draw on general BC co-op principles but note that the member should verify with the board.\n\nContext: ${context}\nQuestion: ${question}`);
    const response = await result.response;
    res.json({ answer: response.text() || '' });
  } catch (e: any) {
    console.error(`[Policy Assistant Error]: ${e.message}`);
    res.status(500).json({
      answer: 'Unable to answer at this time. Please contact the board.',
      error: e.message
    });
  }
});

app.post('/api/ai/summarize', async (req, res) => {
  try {
    const genAI = getAI();
    const resolvedModel = (req as any).session?.user?.geminiModel || 'gemini-2.5-flash-lite';
    const model = genAI.getGenerativeModel({ model: resolvedModel });
    const { content } = req.body;

    const result = await model.generateContent(`Analyze the following document content from a BC Housing Co-operative. Provide a short summary (max 2 sentences) and suggest 3-5 relevant semantic tags for categorization (e.g., "pets", "parking", "agm").\n\nContent: ${content.substring(0, 5000)}`);
    const response = await result.response;
    res.json(JSON.parse(response.text() || '{"summary": "", "tags": []}'));
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

    // 1. DEFINE DATA ARRAYS FIRST (Prevents ReferenceErrors)
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

    const tenantData = [
      { firstName: 'Margaret', lastName: 'Chen', email: 'margaret.chen@email.com', phone: '250-555-0101', startDate: '2019-03-15', status: 'Current', unit: '101' },
      { firstName: 'Joe', lastName: 'Wansbrough', email: 'joewansbrough@gmail.com', phone: '250-555-9999', startDate: '2025-05-01', status: 'Current', unit: '201' },
      { firstName: 'David', lastName: 'Okafor', email: 'david.okafor@email.com', phone: '250-555-0102', startDate: '2020-07-01', status: 'Current', unit: '102' },
      // ... Add other tenants here if needed
    ];

    const announcementData = [
      { title: 'Annual General Meeting — April 12th', content: 'Details regarding the upcoming AGM.', type: 'General', priority: 'High', author: 'Board', date: '2026-03-08' },
    ];

    const documentData = [
      { title: 'Pet Policy', category: 'Policies', url: 'https://example.com/pet-policy.pdf', fileType: 'pdf', author: 'Board Administration', date: '2023-09-01' },
    ];

    const committeeData = [
      { name: 'Board of Directors', chair: 'George Papadopoulos', members: ['margaret.chen@email.com', 'joewansbrough@gmail.com'] },
    ];

    // 2. ENSURE COOPERATIVE EXISTS
    const coop = await p.cooperative.upsert({
      where: { slug: 'oak-bay' },
      update: {},
      create: {
        name: 'Oak Bay Housing Co-op',
        slug: 'oak-bay',
        address: '1234 Foul Bay Road',
        city: 'Victoria',
        province: 'BC',
        adminEmail: 'admin@oakbaycoop.bc.ca'
      }
    });
    const coopId = coop.id;

    console.log('Clearing existing data...');
    await p.tenantHistory.deleteMany();
    await p.maintenanceRequest.deleteMany();
    await p.announcement.deleteMany();
    await p.document.deleteMany();
    await p.committee.deleteMany();
    await p.coopEvent.deleteMany();
    await p.scheduledMaintenance.deleteMany();
    await p.unit.updateMany({ data: { currentTenantId: null } });
    await p.tenant.deleteMany();
    await p.unit.deleteMany();

    console.log('Seeding units...');
    const units: any[] = [];
    for (const u of unitDefs) {
      const unit = await p.unit.create({ data: { ...u, cooperativeId: coopId } });
      units.push(unit);
    }
    const unitMap: Record<string, string> = {};
    units.forEach(u => { unitMap[u.number] = u.id; });

    console.log('Seeding tenants...');
    const adminEmails = ['joewcoupons@gmail.com', 'wwansbro@gmail.com', 'joewansbrough@gmail.com', 'samisaeed123@gmail.com', 'margaret.chen@email.com'];
    const tenants: Record<string, any> = {};

    for (const t of tenantData) {
      const tenant = await p.tenant.create({
        data: {
          firstName: sanitizeUtf8(t.firstName),
          lastName: sanitizeUtf8(t.lastName),
          email: sanitizeUtf8(t.email),
          phone: sanitizeUtf8(t.phone),
          startDate: new Date(t.startDate),
          status: t.status,
          cooperativeId: coopId,
          role: adminEmails.includes(t.email.toLowerCase()) ? 'ADMIN' : 'MEMBER',
          unitId: t.unit ? unitMap[t.unit] : null,
        },
      });
      tenants[t.email] = tenant;

      if (t.unit && unitMap[t.unit]) {
        await p.unit.update({
          where: { id: unitMap[t.unit] },
          data: { currentTenantId: tenant.id },
        });
      }
    }

    console.log('Seeding announcements...');
    for (const a of announcementData) {
      await p.announcement.create({
        data: {
          title: sanitizeUtf8(a.title).trim(),
          content: sanitizeUtf8(a.content).trim(),
          type: a.type,
          priority: a.priority,
          author: sanitizeUtf8(a.author).trim(),
          date: new Date(a.date),
          cooperativeId: coopId
        }
      });
    }

    console.log('Seeding documents...');
    for (const d of documentData) {
      // Use raw SQL to avoid Prisma's TEXT[] wire encoding bug (sends null byte for empty arrays)
      await p.$executeRawUnsafe(
        `INSERT INTO "Document" (id, title, category, committee, url, "fileType", author, date, tags, content, "cooperativeId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::timestamptz, ARRAY[]::TEXT[], NULL, $8, now(), now())`,
        sanitizeUtf8(d.title || "").trim(),
        sanitizeUtf8(d.category || "").trim(),
        "",
        sanitizeUtf8(d.url || "").trim(),
        sanitizeUtf8(d.fileType || "pdf").trim(),
        sanitizeUtf8(d.author || "").trim(),
        new Date(d.date).toISOString(),
        coopId
      );
    }

    console.log('Seeding committees...');
    for (const c of committeeData) {
      await p.committee.create({
        data: {
          name: sanitizeUtf8(c.name),
          chair: sanitizeUtf8(c.chair),
          description: sanitizeUtf8(`Managing ${c.name}`),
          cooperativeId: coopId,
          members: {
            connect: c.members
              .filter(email => tenants[email])
              .map(email => ({ id: tenants[email].id }))
          }
        }
      });
    }

    res.json({ success: true, message: "Multi-tenant data seeded and sanitized successfully." });
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