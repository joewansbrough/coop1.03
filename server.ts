
import express from 'express';
import { createServer as createViteServer } from 'vite';
import cookieSession from 'cookie-session';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';
import multer from 'multer';
import pdf from 'pdf-parse';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
// Database client
const prisma = new PrismaClient();

// Mock Data (In a real app, these would be in a database)
const ADMIN_EMAILS = ['joewcoupons@gmail.com', 'joewansbrough@gmail.com'];

async function startServer() {
  const app = express();
  
  // Trust proxy for secure cookies behind nginx
  app.set('trust proxy', true);

  // Aggressively force req.secure to true for the preview environment
  app.use((req, res, next) => {
    const host = req.get('x-forwarded-host') || req.get('host') || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const proto = req.get('x-forwarded-proto');
    
    if (!isLocal || proto === 'https' || req.get('x-forwarded-port') === '443') {
      Object.defineProperty(req, 'secure', { get: () => true, configurable: true });
      Object.defineProperty(req, 'protocol', { get: () => 'https', configurable: true });
    }
    next();
  });

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'default_secret'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true, // Always true because we force https in the previous middleware
    sameSite: 'none',
    httpOnly: true,
    signed: true,
    overwrite: true,
  }));

  // Helper to get base URL
  const getBaseUrl = (req: express.Request) => {
    const host = req.get('x-forwarded-host') || req.get('host') || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    
    // Always use https for the external preview URL
    const protocol = isLocal ? proto : 'https';
    
    let url = `${protocol}://${host}`;
    
    // If we have an APP_URL env var, use it as a fallback if host is missing
    if (process.env.APP_URL && !host) {
      url = process.env.APP_URL;
    }

    // Ensure no trailing slash
    url = url.replace(/\/+$/, "");
    
    // Final safety check: if it's not local, force it to https://
    if (!isLocal && url.startsWith('http://')) {
      url = 'https://' + url.substring(7);
    }
    
    return url;
  };

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

  // API Request Logger
  app.use('/api', (req, res, next) => {
    console.log(`API Request: ${req.method} ${req.originalUrl}`);
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth Routes
  app.get('/api/auth/url', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/auth/callback`;
    
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured' });
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

  app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('No code provided');
    }

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

      // Check permissions
      let userInDb = await prisma.tenant.findUnique({
        where: { email },
        include: { unit: true }
      });

      const isAdmin = ADMIN_EMAILS.includes(email);
      
      if (!userInDb && !isAdmin) {
        return res.send(`<html><body><script>alert("Access denied for ${email}. You are not registered in the co-op database.");window.close();</script></body></html>`);
      }

      // Set session
      (req as any).session.user = {
        email,
        name: userData.name,
        picture: userData.picture,
        isAdmin,
        tenantId: userInDb?.id || null,
        unitNumber: userInDb?.unit?.number || null
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

  app.get('/api/auth/me', (req, res) => {
    res.json({ user: (req as any).session?.user || null });
  });

  app.post('/api/auth/logout', (req, res) => {
    (req as any).session = null;
    res.json({ success: true });
  });

  // Development Bypass Login
  app.post('/api/auth/bypass', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
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
    try {
      const units = await prisma.unit.findMany({
        include: { 
          currentTenant: true,
          occupancyHistory: {
            include: { tenant: true }
          }
        }
      });
      res.json(units);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch units' });
    }
  });

  app.get('/api/tenants', async (req, res) => {
    try {
      const tenants = await prisma.tenant.findMany({
        include: { 
          unit: true,
          history: {
            include: { unit: true }
          }
        }
      });
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tenants' });
    }
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
    const { title, description, status, priority, category, unitId, notes, expenses } = req.body;
    try {
      const request = await prisma.maintenanceRequest.update({
        where: { id: req.params.id },
        data: { 
          title, 
          description, 
          status, 
          priority, 
          category: Array.isArray(category) ? category[0] : category, 
          unitId,
          notes: notes ? (Array.isArray(notes) ? notes : [notes]) : undefined,
          expenses: expenses ? (Array.isArray(expenses) ? expenses : [expenses]) : undefined
        }
      });
      res.json(request);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/maintenance/:id', async (req, res) => {
    await prisma.maintenanceRequest.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  });

  app.get('/api/announcements', async (req, res) => {
    try {
      const announcements = await prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(announcements);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch announcements' });
    }
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
    try {
      const documents = await prisma.document.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  app.post('/api/documents/upload', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error('Multer Error:', err);
        return res.status(400).json({ error: 'File upload error', details: err.message });
      } else if (err) {
        console.error('Unknown upload error:', err);
        return res.status(500).json({ error: 'Server error during upload', details: err.message });
      }
      next();
    });
  }, async (req, res) => {
    console.log('--- Document Upload Started ---');
    if (!req.file) {
      console.error('Upload Error: No file in request');
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    console.log(`File received: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);

    try {
      let content = '';
      if (req.file.mimetype === 'application/pdf') {
        console.log('Processing PDF file...');
        try {
          // pdf-parse can sometimes be exported as a default function or a property on the default export
          const pdfParser = (pdf as any).default || pdf;
          const data = await pdfParser(req.file.buffer);
          content = data.text;
          console.log(`PDF processed successfully. Extracted ${content.length} characters.`);
        } catch (pdfErr: any) {
          console.error('PDF parsing error:', pdfErr);
          // Fallback to empty string or throw error
          content = `[PDF content could not be extracted: ${pdfErr.message}]`;
        }
      } else {
        content = req.file.buffer.toString('utf-8');
        console.log(`Text/Generic file processed. Extracted ${content.length} characters.`);
      }

      const { title, category, isPrivate, committee } = req.body;
      console.log(`Metadata: Title="${title}", Category="${category}", Committee="${committee}", Private=${isPrivate}`);
      
      const currentYear = new Date().getFullYear().toString();
      
      // Get AI summary directly
      let summary = "";
      let aiTags: string[] = [];
      try {
        console.log('Requesting AI summary...');
        const ai = getAI();
        const aiResult = await ai.getGenerativeModel({ model: 'gemini-2.0-flash-lite' }).generateContent({
          contents: [{ role: 'user', parts: [{ text: `Analyze the following document content from a BC Housing Co-operative. Provide a short summary (max 2 sentences) and suggest 3-5 relevant semantic tags for categorization (e.g., "pets", "parking", "agm").\n\nContent: ${content.substring(0, 5000)}` }] }],
          generationConfig: {
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
        const aiData = JSON.parse(aiResult.response.text() || '{}');
        summary = aiData.summary || "";
        aiTags = aiData.tags || [];
        console.log('AI summary generated successfully.');
      } catch (aiErr: any) {
        console.error('AI summarization failed during upload:', aiErr.message);
        summary = "Summary unavailable.";
      }

      const committeeTags = committee ? [committee] : [];
      const finalTags = Array.from(new Set([currentYear, ...committeeTags, ...(aiTags || [])]));

      const finalContent = `${summary}\n\n[Uploaded on: ${new Date().toLocaleDateString()}]`;

      console.log('Creating database record...');
      const document = await prisma.document.create({
        data: {
          title: title || 'Untitled Document',
          category: category || 'General',
          isPrivate: isPrivate === 'true',
          content: finalContent,
          tags: finalTags,
          url: '#', // Placeholder, in a real app this would be a file storage URL
          fileType: req.file.mimetype.split('/')[1] || 'unknown',
          author: (req as any).session?.user?.name || 'System',
          date: new Date().toISOString().split('T')[0],
        }
      });
      console.log(`Document created successfully with ID: ${document.id}`);
      res.json(document);
    } catch (error: any) {
      console.error('CRITICAL: File upload process failed:', error);
      res.status(500).json({ error: 'Failed to process file upload.', details: error.message });
    } finally {
      console.log('--- Document Upload Finished ---');
    }
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
      const mapped = committees.map(c => ({
        ...c,
        members: c.members.map((m: any) => `${m.firstName} ${m.lastName}`)
      }));
      res.json(mapped);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch committees' });
    }
  });

  app.get('/api/events', async (req, res) => {
    try {
      const events = await prisma.coopEvent.findMany({
        include: { attendees: true },
        orderBy: { date: 'asc' }
      });
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch events' });
    }
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
  const getAI = () => new GoogleGenAI(process.env.API_KEY || '');

  app.post('/api/ai/triage', async (req, res) => {
    try {
      const ai = getAI();
      const { description } = req.body;
      const response = await ai.getGenerativeModel({ model: 'gemini-2.0-flash-lite' }).generateContent({
        contents: [{ role: 'user', parts: [{ text: `Evaluate the following maintenance request for a BC housing co-op and return a suggested urgency level (Low, Medium, High, Emergency) and a category (Plumbing, Electrical, Structural, Appliance, Other). Request: "${description}"` }] }],
        generationConfig: {
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
      res.json(JSON.parse(response.response.text() || '{}'));
    } catch (e: any) {
      res.status(500).json({ urgency: 'Medium', category: 'Other', error: e.message });
    }
  });

  app.post('/api/ai/policy', async (req, res) => {
    try {
      const ai = getAI();
      const { question, context } = req.body;
      const response = await ai.getGenerativeModel({ model: 'gemini-2.0-flash-lite' }).generateContent({
        contents: [{ role: 'user', parts: [{ text: `You are an AI assistant for a BC Housing Co-operative. Answer the following member question based on the provided policy context and your knowledge of BC co-operative housing law. If the answer isn't in the context, draw on general BC co-op principles but note that the member should verify with the board.\n\nContext: ${context}\nQuestion: ${question}` }] }]
      });
      res.json({ answer: response.response.text() });
    } catch (e: any) {
      res.status(500).json({ answer: 'Unable to answer at this time. Please contact the board.', error: e.message });
    }
  });

  app.post('/api/ai/summarize', async (req, res) => {
    try {
      const ai = getAI();
      const { content } = req.body;
      const response = await ai.getGenerativeModel({ model: 'gemini-2.0-flash-lite' }).generateContent({
        contents: [{ role: 'user', parts: [{ text: `Analyze the following document content from a BC Housing Co-operative. Provide a short summary (max 2 sentences) and suggest 3-5 relevant semantic tags for categorization (e.g., "pets", "parking", "agm").\n\nContent: ${content.substring(0, 5000)}` }] }],
        generationConfig: {
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
      res.json(JSON.parse(response.response.text() || '{}'));
    } catch (e: any) {
      res.status(500).json({ summary: '', tags: [], error: e.message });
    }
  });

  app.get('/api/debug/config', (req, res) => {
    const host = req.get('x-forwarded-host') || req.get('host') || '';
    res.json({
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      appUrl: process.env.APP_URL,
      baseUrl: getBaseUrl(req),
      nodeEnv: process.env.NODE_ENV,
      isSecure: req.secure,
      protocol: req.protocol,
      host,
      hasSession: !!(req as any).session,
      hasUser: !!(req as any).session?.user,
    });
  });

  app.get('/api/tenants/:id/history', async (req, res) => {
    try {
      const history = await prisma.tenantHistory.findMany({
        where: { tenantId: req.params.id },
        include: { unit: true },
        orderBy: { startDate: 'desc' }
      });
      res.json(history);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/units/:id/move-out', async (req, res) => {
    const { date, reason } = req.body;
    try {
      // 1. Find all members currently in this unit
      const residents = await prisma.tenant.findMany({
        where: { unitId: req.params.id }
      });

      // 2. Update Unit status
      await prisma.unit.update({
        where: { id: req.params.id },
        data: { status: 'Vacant', currentTenantId: null }
      });

      // 3. Update all residents
      for (const resident of residents) {
        await prisma.tenant.update({
          where: { id: resident.id },
          data: { status: 'Past', unitId: null }
        });

        // Close history record for each resident
        const history = await prisma.tenantHistory.findFirst({
          where: { tenantId: resident.id, unitId: req.params.id, endDate: null },
          orderBy: { startDate: 'desc' }
        });

        if (history) {
          await prisma.tenantHistory.update({
            where: { id: history.id },
            data: { endDate: new Date(date), moveReason: reason || 'Household Move-out' }
          });
        } else {
          // Backfill: Create record if missing
          await prisma.tenantHistory.create({
            data: {
              tenantId: resident.id,
              unitId: req.params.id,
              startDate: new Date(resident.startDate || date),
              endDate: new Date(date),
              moveReason: reason || 'Household Move-out (Archived)'
            }
          });
        }
      }

      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/units/:id/move-in', async (req, res) => {
    const { tenantId, date } = req.body;
    try {
      // 1. Update Unit status
      await prisma.unit.update({
        where: { id: req.params.id },
        data: { status: 'Occupied', currentTenantId: tenantId }
      });

      // 2. Update Tenant status
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'Current', unitId: req.params.id, startDate: date }
      });

      // 3. Create new History record
      await prisma.tenantHistory.create({
        data: {
          tenantId,
          unitId: req.params.id,
          startDate: new Date(date),
          moveReason: 'Move-in'
        }
      });

      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/units/:id/transfer', async (req, res) => {
    const { fromUnitId, toUnitId, date } = req.body;
    try {
      // 1. Find all residents in the source unit
      const residents = await prisma.tenant.findMany({
        where: { unitId: fromUnitId }
      });

      if (residents.length === 0) {
        return res.status(400).json({ error: 'No residents found in source unit' });
      }

      // 2. Vacate old unit
      await prisma.unit.update({
        where: { id: fromUnitId },
        data: { status: 'Vacant', currentTenantId: null }
      });

      // 3. Occupy new unit (Assign first resident as primary for the relation)
      await prisma.unit.update({
        where: { id: toUnitId },
        data: { status: 'Occupied', currentTenantId: residents[0].id }
      });

      // 4. Update all residents and their history
      for (const resident of residents) {
        await prisma.tenant.update({
          where: { id: resident.id },
          data: { unitId: toUnitId, startDate: date }
        });

        // Close old history
        const oldHistory = await prisma.tenantHistory.findFirst({
          where: { tenantId: resident.id, unitId: fromUnitId, endDate: null },
          orderBy: { startDate: 'desc' }
        });
        
        if (oldHistory) {
          await prisma.tenantHistory.update({
            where: { id: oldHistory.id },
            data: { endDate: new Date(date), moveReason: 'Internal Transfer' }
          });
        } else {
          // Backfill: Create record for old unit
          await prisma.tenantHistory.create({
            data: {
              tenantId: resident.id,
              unitId: fromUnitId,
              startDate: new Date(resident.startDate || date),
              endDate: new Date(date),
              moveReason: 'Internal Transfer (Archived)'
            }
          });
        }

        // Create new history
        await prisma.tenantHistory.create({
          data: {
            tenantId: resident.id,
            unitId: toUnitId,
            startDate: new Date(date),
            moveReason: 'Internal Transfer'
          }
        });
      }

      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // API 404 handler
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
