import express from 'express';
import cookieSession from 'cookie-session';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { z } from 'zod';
import { maintenanceSchema, documentSchema, announcementSchema, tenantSchema } from './validation.js';
import driveRoutes from './drive.js';

const app = express();

// Trust proxy for secure cookies on Vercel
app.set('trust proxy', true);

// Health check route (at the very top to bypass middleware if needed)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Standard cookie-session middleware
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'default_secret'],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: true, // Always true on Vercel (HTTPS)
  sameSite: 'none',
  httpOnly: true,
  signed: true,
  overwrite: true,
}));

// Mock Data
const ADMIN_EMAILS = ['joewcoupons@gmail.com', 'wwansbro@gmail.com', 'joewansbrough@gmail.com', 'samisaeed123@gmail.com'];


const getCoopId = async (req: any, p: any = getPrisma()) => {
  const sessionUser = req.session?.user;
  if (sessionUser?.tenantId) {
    const t = await p.tenant.findUnique({ where: { id: sessionUser.tenantId } });
    if (t?.cooperativeId) return t.cooperativeId;
  }
  const first = await p.cooperative.findFirst();
  if (!first) throw new Error("No cooperative found in the system.");
  return first.id;
};

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const hasUser = !!(req as any).session?.user;
  if (!hasUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};

// Robust Helper to get base URL
const getBaseUrl = (req: express.Request) => {
  const host = req.get('x-forwarded-host') || req.get('host');
  const protocol = req.get('x-forwarded-proto') || 'https';
  
  if (process.env.APP_URL && !host) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }
  
  if (!host) return 'https://coop1-03.vercel.app'; // Hard fallback for this project
  
  const url = `${protocol}://${host}`;
  return url.replace(/\/+$/, "");
};

// API Request Logger
app.use('/api', (req, res, next) => {
  if (req.path !== '/health') {
    console.log(`API Request: ${req.method} ${req.originalUrl}`);
  }
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
  try {
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/auth/callback`;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('CRITICAL: GOOGLE_CLIENT_ID is missing from env');
      return res.status(500).json({ 
        error: 'GOOGLE_CLIENT_ID is not configured in Vercel environment variables',
        details: 'Check Vercel Project Settings > Environment Variables'
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    res.json({ url: authUrl });
  } catch (err: any) {
    console.error('Error generating auth URL:', err);
    res.status(500).json({ error: 'Failed to generate auth URL', details: err.message });
  }
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

// With your other routes, under your auth middleware
app.use('/api/drive', requireAuth, driveRoutes);

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
      data: {
        tenant: { connect: { id: tenantId } },
        unit: { connect: { id } },
        cooperative: { connect: { id: tenant.cooperativeId } },
        startDate: new Date(date)
      }
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
    await getPrisma().$transaction(async (tx) => {
      // Find all residents of the source unit
      const residents = await tx.tenant.findMany({ where: { unitId: id, status: 'Current' } });

      if (residents.length === 0) {
        throw new Error('No current residents found in source unit to transfer.');
      }

      for (const tenant of residents) {
        // Close open history on source unit
        const openHistory = await tx.tenantHistory.findFirst({
          where: { tenantId: tenant.id, unitId: id, endDate: null },
          orderBy: { startDate: 'desc' }
        });
        if (openHistory) {
          await tx.tenantHistory.update({
            where: { id: openHistory.id },
            data: { endDate: new Date(date), moveReason: 'Internal Unit Transfer' }
          });
        }

        // Open new history on destination unit
        await tx.tenantHistory.create({
          data: {
            tenant: { connect: { id: tenant.id } },
            unit: { connect: { id: toUnitId } },
            cooperative: { connect: { id: tenant.cooperativeId } },
            startDate: new Date(date),
            moveReason: 'Internal Unit Transfer'
          }
        });

        // Update tenant's unit
        await tx.tenant.update({
          where: { id: tenant.id },
          data: { unitId: toUnitId, startDate: new Date(date) }
        });
      }

      // Vacate source unit
      await tx.unit.update({ 
        where: { id }, 
        data: { status: 'Vacant', currentTenantId: null } 
      });

      // Occupy destination unit
      await tx.unit.update({
        where: { id: toUnitId },
        data: { status: 'Occupied', currentTenantId: residents[0].id }
      });
    });

    res.json({ success: true });
  } catch (e: any) { 
    console.error('Transfer error:', e);
    res.status(500).json({ error: e.message }); 
  }
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
      cooperativeId: await getCoopId(req, getPrisma()),
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
    data: {
      cooperativeId: await getCoopId(req, getPrisma()), title, content, type, priority, author, date }
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
      cooperativeId: await getCoopId(req, getPrisma()),
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
    data: {
      cooperativeId: await getCoopId(req, getPrisma()), title, description, date, time, location, category },
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

    // 1. DATA DEFINITIONS
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
      { number: '210', type: '1BR', floor: 2, status: 'Occupied' },
      { number: '301', type: '3BR', floor: 3, status: 'Occupied' },
      { number: '302', type: '2BR', floor: 3, status: 'Occupied' },
      { number: '303', type: '1BR', floor: 3, status: 'Occupied' },
      { number: '304', type: '2BR', floor: 3, status: 'Vacant' },
      { number: '305', type: '3BR', floor: 3, status: 'Occupied' },
      { number: '306', type: '4BR', floor: 3, status: 'Occupied' },
      { number: '307', type: '2BR', floor: 3, status: 'Occupied' },
      { number: '308', type: '1BR', floor: 3, status: 'Occupied' },
      { number: '309', type: '2BR', floor: 3, status: 'Occupied' },
      { number: '310', type: '3BR', floor: 3, status: 'Occupied' },
      { number: '401', type: '2BR', floor: 4, status: 'Occupied' },
      { number: '402', type: '1BR', floor: 4, status: 'Occupied' },
      { number: '403', type: '2BR', floor: 4, status: 'Occupied' },
      { number: '404', type: '1BR', floor: 4, status: 'Occupied' },
      { number: '405', type: '2BR', floor: 4, status: 'Vacant' },
      { number: '406', type: '1BR', floor: 4, status: 'Occupied' },
      { number: '407', type: '2BR', floor: 4, status: 'Occupied' },
    ];

    const tenantData = [
      // Couples in 102, 103, 104, 202, 205, 301, 305, 306, 309, 401, 403, 407
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
      { firstName: 'Joe', lastName: 'Wansbrough', email: 'joewansbrough@gmail.com', phone: '250-555-9999', startDate: '2025-05-01', status: 'Current', unit: '210' },
      // Waitlist
      { firstName: 'Alice', lastName: 'Waites', email: 'alice.wait@email.com', phone: '250-555-1001', startDate: '2026-01-01', status: 'Waitlist', unit: null },
      { firstName: 'Bob', lastName: 'Waites', email: 'bob.wait@email.com', phone: '250-555-1002', startDate: '2026-01-01', status: 'Waitlist', unit: null },
      { firstName: 'Sarah', lastName: 'Jenkins', email: 'sarah.j@email.com', phone: '250-555-1003', startDate: '2026-02-15', status: 'Waitlist', unit: null },
      { firstName: 'Mike', lastName: 'Ross', email: 'mike.ross@email.com', phone: '250-555-1004', startDate: '2026-03-01', status: 'Waitlist', unit: null },
      { firstName: 'Rachel', lastName: 'Zane', email: 'rachel.z@email.com', phone: '250-555-1005', startDate: '2026-03-01', status: 'Waitlist', unit: null },
      { firstName: 'Harvey', lastName: 'Specter', email: 'harvey.s@email.com', phone: '250-555-1006', startDate: '2026-03-10', status: 'Waitlist', unit: null },
      { firstName: 'Donna', lastName: 'Paulsen', email: 'donna.p@email.com', phone: '250-555-1007', startDate: '2026-03-10', status: 'Waitlist', unit: null },
      { firstName: 'Louis', lastName: 'Litt', email: 'louis.l@email.com', phone: '250-555-1008', startDate: '2026-04-01', status: 'Waitlist', unit: null },
    ];

    const maintenanceData = [
      { title: 'Leaking kitchen faucet', description: 'Constant drip in 101.', status: 'Pending', priority: 'Medium', category: 'Plumbing', unitNumber: '101', requestedBy: 'margaret.chen@email.com' },
      { title: 'Bathroom exhaust fan', description: 'Not working since Tuesday.', status: 'In Progress', priority: 'Medium', category: 'Electrical', unitNumber: '102', requestedBy: 'david.okafor@email.com' },
      { title: 'Broken window latch', description: 'Security risk on ground floor.', status: 'Resolved', priority: 'High', category: 'Security', unitNumber: '104', requestedBy: 'james.nakamura@email.com' },
      { title: 'Hallway light flickering', description: 'Near unit 205.', status: 'Resolved', priority: 'Low', category: 'Electrical', unitNumber: '205', requestedBy: 'patricia.macleod@email.com' },
      { title: 'No hot water', description: 'Whole unit affected.', status: 'Pending', priority: 'High', category: 'Plumbing', unitNumber: '301', requestedBy: 'george.papadopoulos@email.com' },
      { title: 'Fridge making loud noise', description: 'Internal fan issue?', status: 'In Progress', priority: 'Low', category: 'Appliance', unitNumber: '306', requestedBy: 'ahmed.patel@email.com' },
      { title: 'Drafty balcony door', description: 'Needs new weather stripping.', status: 'Pending', priority: 'Medium', category: 'Carpentry', unitNumber: '407', requestedBy: 'natasha.ivanova@email.com' },
      { title: 'Intercom not buzzing', description: 'Can hear guests but can\'t let them in.', status: 'Resolved', priority: 'Medium', category: 'Electrical', unitNumber: '201', requestedBy: 'aisha.mohammed@email.com' },
      { title: 'Loose floorboards', description: 'Tripping hazard in living room.', status: 'Pending', priority: 'Low', category: 'Flooring', unitNumber: '109', requestedBy: 'lena.kowalski@email.com' },
      { title: 'Slow drain in tub', description: 'Standing water after shower.', status: 'Resolved', priority: 'Medium', category: 'Plumbing', unitNumber: '402', requestedBy: 'ravi.krishnamurthy@email.com' },
      { title: 'Clogged gutter', description: 'Overflowing onto balcony during rain.', status: 'Pending', priority: 'Medium', category: 'Exterior', unitNumber: '401', requestedBy: 'bernard.lefebvre@email.com' },
      { title: 'Loose railing', description: 'External stairs near parking.', status: 'In Progress', priority: 'High', category: 'Safety', unitNumber: '101', requestedBy: 'margaret.chen@email.com' },
    ];

    const announcementData = [
      { title: 'Annual General Meeting — April 12th', content: 'Co-op AGM details and agenda in the common room.', type: 'General', priority: 'High', author: 'Board', date: '2026-03-08' },
      { title: 'New Pet Policy Adopted', content: 'The new rules regarding pet size and registration are now in effect.', type: 'Policy', priority: 'Medium', author: 'Board', date: '2026-01-15' },
      { title: 'Spring Landscaping Clean-up', content: 'Volunteers needed for Saturday morning garden work.', type: 'Event', priority: 'Low', author: 'Maintenance', date: '2026-03-20' },
      { title: 'Elevator Maintenance Schedule', content: 'Elevator will be out of service for inspection on Wednesday.', type: 'Alert', priority: 'High', author: 'Maintenance', date: '2026-04-01' },
      { title: 'Parking Lot Repaving', content: 'Please move all vehicles by 8 AM on Monday morning.', type: 'Alert', priority: 'High', author: 'Board', date: '2026-04-10' },
    ];

    const eventData = [
      { title: 'Co-op AGM', description: 'Official annual meeting and board elections.', date: '2026-04-12T19:00:00Z', location: 'Common Room' },
      { title: 'Block Party Prep', description: 'Planning meeting for the Cook Street Block Party.', date: '2026-04-20T18:30:00Z', location: 'Unit 210' },
      { title: 'Community Garden Kickoff', description: 'First planting session of the year.', date: '2026-05-02T10:00:00Z', location: 'Back Courtyard' },
      { title: 'Coffee & Conversation', description: 'Casual meetup for new and old members.', date: '2026-05-15T11:00:00Z', location: 'Common Room' },
      { title: 'Board Meeting', description: 'Monthly oversight meeting.', date: '2026-04-28T19:30:00Z', location: 'Zoom' },
      { title: 'Summer BBQ', description: 'Annual summer social.', date: '2026-07-04T16:00:00Z', location: 'Front Lawn' },
      { title: 'Emergency Drill', description: 'Fire safety walkthrough for all residents.', date: '2026-05-10T14:00:00Z', location: 'Main Entrance' },
    ];

    const documentData = [
      { title: 'Rules & Regulations', category: 'Bylaws', url: '#', fileType: 'pdf', author: 'Board', date: '2020-01-01' },
      { title: 'Pet Policy 2026', category: 'Policies', url: '#', fileType: 'pdf', author: 'Board', date: '2026-01-15' },
      { title: 'AGM Minutes March 2026', category: 'Minutes', url: '#', fileType: 'pdf', author: 'Secretary', date: '2026-03-10' },
      { title: 'Co-op Membership Application', category: 'Forms', url: '#', fileType: 'pdf', author: 'Admin', date: '2025-11-01' },
      { title: 'Building Safety Map', category: 'Safety', url: '#', fileType: 'pdf', author: 'Maintenance', date: '2024-05-20' },
    ];

    const committeeData = [
      { name: 'Board of Directors', chair: 'George Papadopoulos', members: ['george.papadopoulos@email.com', 'thomas.bergstrom@email.com', 'margaret.chen@email.com', 'joewansbrough@gmail.com'] },
      { name: 'Maintenance Committee', chair: 'Thomas Bergstrom', members: ['thomas.bergstrom@email.com', 'carlos.rivera@email.com', 'patricia.macleod@email.com'] },
      { name: 'Finance Committee', chair: 'Patricia MacLeod', members: ['patricia.macleod@email.com', 'margaret.chen@email.com', 'ahmed.patel@email.com'] },
      { name: 'Membership Committee', chair: 'Linda Nakamura', members: ['linda.nakamura@email.com', 'priya.sharma@email.com', 'yuki.tanaka@email.com'] },
      { name: 'Social Committee', chair: 'Wei Liu', members: ['wei.liu@email.com', 'joewansbrough@gmail.com', 'fatima.alhassan@email.com'] },
      { name: 'Landscape Committee', chair: 'Michael Johansson', members: ['michael.johansson@email.com', 'wei.liu@email.com', 'james.nakamura@email.com'] },
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
      cooperativeId: await getCoopId(req, getPrisma()),
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

    console.log('Seeding maintenance requests...');
    for (const m of maintenanceData) {
      await p.maintenanceRequest.create({
        data: {
      cooperativeId: await getCoopId(req, getPrisma()),
          title: sanitizeUtf8(m.title).trim(),
          description: sanitizeUtf8(m.description).trim(),
          status: m.status,
          priority: m.priority,
          category: m.category,
          unitId: unitMap[m.unitNumber],
          tenantId: tenants[m.requestedBy]?.id || null,
          requestedBy: sanitizeUtf8(m.requestedBy),
          cooperativeId: coopId
        }
      });
    }

    console.log('Seeding events...');
    for (const e of eventData) {
      const dt = new Date(e.date);
      await p.coopEvent.create({
        data: {
      cooperativeId: await getCoopId(req, getPrisma()),
          title: sanitizeUtf8(e.title).trim(),
          description: sanitizeUtf8(e.description).trim(),
          date: dt,
          time: dt.toISOString().split('T')[1].substring(0, 5),
          location: sanitizeUtf8(e.location).trim(),
          category: "General",
          cooperativeId: coopId
        }
      });
    }

    console.log('Seeding announcements...');
    for (const a of announcementData) {
      await p.announcement.create({
        data: {
      cooperativeId: await getCoopId(req, getPrisma()),
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