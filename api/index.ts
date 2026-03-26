import express from 'express';
import cookieSession from 'cookie-session';
import axios from 'axios';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

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
    let user = await prisma.tenant.findUnique({
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
  const units = await prisma.unit.findMany({
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
  const tenants = await prisma.tenant.findMany({
    include: { unit: true }
  });
  res.json(tenants);
});

app.get('/api/tenants/:id/history', async (req, res) => {
  const history = await prisma.tenantHistory.findMany({
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
    const residents = await prisma.tenant.findMany({ where: { unitId: id, status: 'Current' } });

    for (const tenant of residents) {
      // Close any open TenantHistory record for this unit
      const openHistory = await prisma.tenantHistory.findFirst({
        where: { tenantId: tenant.id, unitId: id, endDate: null }
      });
      if (openHistory) {
        await prisma.tenantHistory.update({
          where: { id: openHistory.id },
          data: { endDate: new Date(date), moveReason: reason || 'Voluntary Household Departure' }
        });
      }
      // Mark tenant as Past and unlink from unit
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'Past', unitId: null }
      });
    }

    // Mark unit as Vacant
    await prisma.unit.update({
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
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // If internal transfer: close open history record on their previous unit
    if (tenant.unitId && tenant.unitId !== id) {
      const openHistory = await prisma.tenantHistory.findFirst({
        where: { tenantId, unitId: tenant.unitId, endDate: null }
      });
      if (openHistory) {
        await prisma.tenantHistory.update({
          where: { id: openHistory.id },
          data: { endDate: new Date(date), moveReason: 'Internal Transfer' }
        });
      }
      // Vacate previous unit
      await prisma.unit.update({
        where: { id: tenant.unitId },
        data: { status: 'Vacant', currentTenantId: null }
      });
    }

    // Create new TenantHistory record for the new unit
    await prisma.tenantHistory.create({
      data: { tenantId, unitId: id, startDate: new Date(date) }
    });

    // Update tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { unitId: id, status: 'Current', startDate: date }
    });

    // Update unit
    await prisma.unit.update({
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
    const residents = await prisma.tenant.findMany({ where: { unitId: id, status: 'Current' } });

    for (const tenant of residents) {
      // Close open history on source unit
      const openHistory = await prisma.tenantHistory.findFirst({
        where: { tenantId: tenant.id, unitId: id, endDate: null }
      });
      if (openHistory) {
        await prisma.tenantHistory.update({
          where: { id: openHistory.id },
          data: { endDate: new Date(date), moveReason: 'Internal Unit Transfer' }
        });
      }
      // Open new history on destination unit
      await prisma.tenantHistory.create({
        data: { tenantId: tenant.id, unitId: toUnitId, startDate: new Date(date) }
      });
      // Update tenant's unit
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { unitId: toUnitId, startDate: date }
      });
    }

    // Vacate source unit, occupy destination unit
    await prisma.unit.update({ where: { id }, data: { status: 'Vacant', currentTenantId: null } });
    await prisma.unit.update({
      where: { id: toUnitId },
      data: { status: 'Occupied', currentTenantId: residents[0]?.id ?? null }
    });

    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/maintenance', async (req, res) => {
  try {
    const requests = await prisma.maintenanceRequest.findMany({
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
  const request = await prisma.maintenanceRequest.create({
    data: { title, description, status, priority, category: Array.isArray(category) ? category[0] : category, unitId, requestedBy }
  });
  res.json(request);
});

app.put('/api/maintenance/:id', async (req, res) => {
  const { title, description, status, priority, category, unitId } = req.body;
  const request = await prisma.maintenanceRequest.update({
    where: { id: req.params.id },
    data: { title, description, status, priority, category: Array.isArray(category) ? category[0] : category, unitId }
  });
  res.json(request);
});

app.delete('/api/maintenance/:id', async (req, res) => {
  await prisma.maintenanceRequest.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

app.get('/api/announcements', async (req, res) => {
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(announcements);
});

app.post('/api/announcements', async (req, res) => {
  const { title, content, type, priority, author, date } = req.body;
  const announcement = await prisma.announcement.create({
    data: { title, content, type, priority, author, date }
  });
  res.json(announcement);
});

app.put('/api/announcements/:id', async (req, res) => {
  const { title, content, type, priority, date } = req.body;
  const announcement = await prisma.announcement.update({
    where: { id: req.params.id },
    data: { title, content, type, priority, date }
  });
  res.json(announcement);
});

app.delete('/api/announcements/:id', async (req, res) => {
  await prisma.announcement.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

app.get('/api/documents', async (req, res) => {
  const documents = await prisma.document.findMany({
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

  const document = await prisma.document.create({
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
  const document = await prisma.document.update({
    where: { id: req.params.id },
    data: { title, category, tags, content }
  });
  res.json(document);
});

app.delete('/api/documents/:id', async (req, res) => {
  await prisma.document.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

app.get('/api/committees', async (req, res) => {
  try {
    const committees = await prisma.committee.findMany({
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
  const events = await prisma.coopEvent.findMany({
    include: { attendees: true },
    orderBy: { date: 'asc' }
  });
  res.json(events);
});

app.post('/api/events', async (req, res) => {
  const { title, description, date, time, location, category } = req.body;
  const event = await prisma.coopEvent.create({
    data: { title, description, date, time, location, category },
    include: { attendees: true }
  });
  res.json(event);
});

app.put('/api/events/:id', async (req, res) => {
  const { title, description, date, time, location, category } = req.body;
  const event = await prisma.coopEvent.update({
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
    const tenant = await prisma.tenant.findUnique({ where: { email: user.email } });
    if (!tenant) return res.status(404).json({ error: 'Tenant record not found for this user' });

    const event = await prisma.coopEvent.update({
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
  await prisma.coopEvent.delete({ where: { id: req.params.id } });
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
