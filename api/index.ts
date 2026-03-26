import express from 'express';
import cookieSession from 'cookie-session';
import axios from 'axios';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();

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
const ADMIN_EMAILS = ['joewcoupons@gmail.com', 'wwansbro@gmail.com', 'joewansbrough@gmail.com'];

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

    // For now, let's assume if they are in ADMIN_EMAILS, they are admins
    const isAdmin = ADMIN_EMAILS.includes(email);

    // If not in DB but is admin, we might want to allow them anyway
    if (!user && !isAdmin) {
      return res.send(`<html><body><script>alert("Access denied for ${email}. You are not registered in the co-op database.");window.close();</script></body></html>`);
    }

    (req as any).session.user = {
      email,
      name: userData.name,
      picture: userData.picture,
      isAdmin,
      tenantId: user?.id || null,
      unitNumber: user?.unit?.number || null
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
    // UI expects category as an array
    const mapped = requests.map(r => ({ ...r, category: [r.category] }));
    res.json(mapped);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/maintenance', async (req, res) => {
  const { title, description, status, priority, category, unitId, requestedBy } = req.body;
  const request = await getPrisma().maintenanceRequest.create({
    data: { title, description, status, priority, category: Array.isArray(category) ? category[0] : category, unitId, requestedBy }
  });
  res.json(request);
});

app.put('/api/maintenance/:id', async (req, res) => {
  const { title, description, status, priority, category, unitId } = req.body;
  const request = await getPrisma().maintenanceRequest.update({
    where: { id: req.params.id },
    data: { title, description, status, priority, category: Array.isArray(category) ? category[0] : category, unitId }
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
  const { title, category, url, fileType, author, date, tags, content, committee, isPrivate } = req.body;
  
  let summary = "";
  let aiTags: string[] = [];
  
  // Get AI summary if content is provided
  if (content && content.length > 50) {
    try {
      const ai = getAI();
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
      const aiData = JSON.parse(response.text || '{}');
      summary = aiData.summary || "";
      aiTags = aiData.tags || [];
    } catch (e: any) {
      console.error('AI summarization failed during document creation:', e.message);
    }
  }

  const currentYear = new Date().getFullYear().toString();
  const committeeTags = committee ? [committee] : [];
  const providedTags = Array.isArray(tags) ? tags : [];
  const finalTags = Array.from(new Set([currentYear, ...committeeTags, ...providedTags, ...aiTags]));
  
  const finalContent = summary 
    ? `${summary}\n\n[Uploaded on: ${new Date().toLocaleDateString()}]\n\n${content || ''}`
    : content;

  const document = await getPrisma().document.create({
    data: { 
      title: title || 'Untitled Document', 
      category: category || 'General', 
      url: url || '#', 
      fileType: fileType || 'txt', 
      author: author || ((req as any).session?.user?.name || 'System'), 
      date: date || new Date().toISOString().split('T')[0], 
      tags: finalTags, 
      content: finalContent,
      isPrivate: isPrivate === true
    }
  });
  res.json(document);
});

app.put('/api/documents/:id', async (req, res) => {
  const { title, category, tags, content } = req.body;
  const document = await getPrisma().document.update({
    where: { id: req.params.id },
    data: { title, category, tags, content }
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
            urgency: { type: Type.STRING },
            category: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          },
          required: ['urgency', 'category']
        }
      }
    });
    res.json(JSON.parse(response.text || '{}'));
  } catch (e: any) {
    res.status(500).json({ urgency: 'Medium', category: 'Other', error: e.message });
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
    
    // Manually add missing columns if they don't exist
    // This is a robust way to sync the DB state in serverless environments
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "content" TEXT DEFAULT '';`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;`);
    
    res.json({ 
      success: true, 
      message: "Database schema updated successfully using raw SQL." 
    });
  } catch (e: any) {
    console.error('Migration error:', e);
    res.status(500).json({ 
      success: false, 
      error: e.message,
      stack: e.stack
    });
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
      { title: 'Leaking kitchen faucet', description: 'The kitchen faucet has been dripping constantly for the past week.', status: 'Pending', priority: 'Medium', category: 'Plumbing', unitNumber: '101', requestedBy: 'margaret.chen@email.com', createdAt: new Date('2026-02-28') },
      { title: 'Bathroom exhaust fan not working', description: 'The exhaust fan in the main bathroom stopped working.', status: 'In Progress', priority: 'Medium', category: 'Electrical', unitNumber: '102', requestedBy: 'david.okafor@email.com', createdAt: new Date('2026-02-20') },
      { title: 'Dishwasher not draining', description: 'The dishwasher fills with water but does not drain.', status: 'Completed', priority: 'Medium', category: 'Appliance', unitNumber: '104', requestedBy: 'james.nakamura@email.com', createdAt: new Date('2026-01-15') },
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
      { title: 'Annual General Meeting — April 12th', content: 'Meeting details...', type: 'General', priority: 'High', author: 'Board Administration', date: '2026-03-08' },
      { title: 'Water Shutoff — March 18th', content: 'Shutoff details...', type: 'Maintenance', priority: 'Urgent', author: 'Maintenance Committee', date: '2026-03-06' },
    ];
    for (const a of announcementData) {
      await p.announcement.create({ data: a });
    }

    console.log('Seeding documents...');
    const documentData = [
      { title: 'Oak Bay Co-op Rules & Regulations 2024', category: 'Bylaws', url: '#', fileType: 'pdf', author: 'Board Administration', date: '2024-01-15', tags: ['legal', 'governance', 'bylaws'] },
      { title: 'Member Handbook 2025', category: 'Policy', url: '#', fileType: 'pdf', author: 'Membership Committee', date: '2025-01-01', tags: ['handbook', 'rules'] },
    ];
    for (const d of documentData) {
      await p.document.create({ data: d });
    }

    console.log('Seeding committees...');
    const committeeData = [
      { name: 'Board of Directors', description: 'Governing body.', chair: 'George Papadopoulos', icon: 'fa-landmark', members: ['george.papadopoulos@email.com', 'thomas.bergstrom@email.com'] },
      { name: 'Maintenance Committee', description: 'Building upkeep.', chair: 'Thomas Bergstrom', icon: 'fa-wrench', members: ['thomas.bergstrom@email.com', 'robert.tremblay@email.com'] },
      { name: 'Finance Committee', description: 'Budgets.', chair: 'Patricia MacLeod', icon: 'fa-dollar-sign', members: ['patricia.macleod@email.com', 'margaret.chen@email.com'] },
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
