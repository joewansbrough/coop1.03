
import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import cookieSession from 'cookie-session';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import multer from 'multer';
import * as pdf from 'pdf-parse';

import { z } from 'zod';
import { maintenanceSchema, documentSchema, announcementSchema, tenantSchema } from './api/validation.js';
import driveRoutes from './api/drive.js';

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set before starting the server');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
// Database client
const prisma = new PrismaClient();

// Legacy Admin List (Fallback during migration)
const ADMIN_EMAILS = ['joewcoupons@gmail.com', 'joewansbrough@gmail.com', 'wwansbro@gmail.com', 'samisaeed123@gmail.com'];


const getCoopId = async (req: any, p: any = prisma) => {
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
  const host = req.get('x-forwarded-host') || req.get('host') || '';
  const isLocal = host.includes('localhost') || 
                  host.includes('127.0.0.1') || 
                  req.ip === '::1' || 
                  req.ip === '127.0.0.1' ||
                  req.hostname === 'localhost';
  
  const hasUser = !!(req as any).session?.user;
  if (!hasUser && !isLocal) {
    console.log(`[Auth Blocked] Host: ${host}, IP: ${req.ip}, URL: ${req.originalUrl}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};

type BodyValue = string | string[] | undefined;

const firstString = (value?: BodyValue): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const ensureString = (value: BodyValue, fallback = ''): string => firstString(value) ?? fallback;
const optionalString = (value: BodyValue): string | undefined => firstString(value);
const ensureArray = (value: BodyValue): string[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

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

async function startServer() {
  const app = express();
  
  // Trust proxy for secure cookies behind nginx
  app.set('trust proxy', true);

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  
  app.use((req, res, next) => {
    const host = req.get('x-forwarded-host') || req.get('host') || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

    cookieSession({
      name: 'session',
      keys: [SESSION_SECRET],
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: !isLocal, // Disable secure on localhost to allow development without HTTPS
      sameSite: isLocal ? 'lax' : 'none',
      httpOnly: true,
      signed: true,
      overwrite: true,
    })(req, res, next);
  });

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
      scope: 'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
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

      // Check permissions (Hybrid DB Role + Legacy List)
      let userInDb = await prisma.tenant.findUnique({
        where: { email },
        include: { unit: true }
      });

      const isAdminByList = ADMIN_EMAILS.includes(email);
      const isAdminByRole = userInDb?.role === 'ADMIN';
      const isAdmin = isAdminByList || isAdminByRole;
      
      if (!userInDb && !isAdmin) {
        return res.send(`<html><body><script>alert("Access denied for ${email}. You are not registered in the co-op database.");window.close();</script></body></html>`);
      }

      // Set session
      (req as any).session.user = {
        email,
        name: userData.name,
        picture: userData.picture,
        isAdmin,
        role: userInDb?.role || (isAdminByList ? 'ADMIN' : 'MEMBER'),
        tenantId: userInDb?.id || null,
        unitNumber: userInDb?.unit?.number || null,
        accessToken: access_token
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

  app.get('/api/units', requireAuth, async (req, res) => {
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

  app.get('/api/units/:id/scheduled-maintenance', requireAuth, async (req, res) => {
    try {
      const tasks = await prisma.scheduledMaintenance.findMany({
        where: {
          unitId: req.params.id,
          category: typeof req.query.category === 'string' ? req.query.category : undefined
        },
        orderBy: { dueDate: 'asc' }
      });
      res.json(tasks);
    } catch (error: any) {
      console.error('Scheduled Maintenance error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/seed/preventative', requireAuth, async (req, res) => {
    try {
      const units = await prisma.unit.findMany();
      const existingTasks = await prisma.scheduledMaintenance.findMany();
      const existingTaskMap = new Map();
      existingTasks.forEach(task => existingTaskMap.set(`${task.unitId}-${task.task}`, task));

      console.log('Seeding preventative maintenance tasks...');
      const tasksToSeed = [];

      units.forEach(unit => {
        const numTasks = Math.floor(Math.random() * 4) + 1; // 1 to 4 tasks

        for (let i = 0; i < numTasks; i++) {
          const today = new Date();
          let taskDetails;

          switch (i) {
            case 0:
              taskDetails = {
                unitId: unit.id,
                task: 'HVAC Filter Replacement',
                dueDate: new Date(today.setMonth(today.getMonth() + 1)).toISOString().split('T')[0],
                frequency: Math.random() > 0.5 ? 'MONTHLY' : 'QUARTERLY' as const,
                assignedTo: 'Building Management',
                category: 'HVAC' as const,
              };
              break;
            case 1:
              taskDetails = {
                unitId: unit.id,
                task: Math.random() > 0.5 ? 'Water Heater Flush' : 'Inspect Electrical Panel',
                dueDate: new Date(today.setMonth(today.getMonth() + (Math.random() > 0.5 ? 3 : 6))).toISOString().split('T')[0],
                frequency: Math.random() > 0.5 ? 'QUARTERLY' : 'ANNUAL' as const,
                assignedTo: Math.random() > 0.5 ? 'Maintenance Team' : 'Electrician',
                category: Math.random() > 0.5 ? 'PLUMBING' : 'ELECTRICAL' as const,
              };
              break;
            case 2:
              taskDetails = {
                unitId: unit.id,
                task: Math.random() > 0.5 ? 'Annual Fire Alarm Test' : 'Inspect Balcony Sealant',
                dueDate: new Date(today.setFullYear(today.getFullYear() + 1)).toISOString().split('T')[0],
                frequency: 'ANNUAL' as const,
                assignedTo: Math.random() > 0.5 ? 'Safety Officer' : 'Exterior Maintenance',
                category: Math.random() > 0.5 ? 'SAFETY' : 'GENERAL' as const,
              };
              break;
            default:
              taskDetails = {
                unitId: unit.id,
                task: Math.random() > 0.5 ? 'Test Smoke Detectors' : 'Dryer Vent Cleaning',
                dueDate: new Date(today.setMonth(today.getMonth() + 2)).toISOString().split('T')[0],
                frequency: 'ANNUAL' as const,
                assignedTo: 'In-House Staff',
                category: Math.random() > 0.5 ? 'SAFETY' : 'GENERAL' as const,
              };
              break;
          }
          tasksToSeed.push(taskDetails);
        }
      });

      let addedCount = 0;
      for (const task of tasksToSeed) {
        if (!existingTaskMap.has(`${task.unitId}-${task.task}`)) {
          await prisma.scheduledMaintenance.create({
            data: { ...task, isCompleted: false, isActive: true }
          });
          addedCount++;
        }
      }

      res.json({ success: true, message: `Preventative tasks seeded. ${addedCount} new tasks added.` });
    } catch (e: any) {
      console.error('Preventative seeding error:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/tenants', requireAuth, validateRequest(tenantSchema), async (req, res) => {
    try {
      const tenant = await prisma.tenant.create({
        data: req.body,
        include: { unit: true }
      });
      res.json(tenant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/tenants', requireAuth, async (req, res) => {
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

  app.get('/api/maintenance', requireAuth, async (req, res) => {
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

  app.post('/api/maintenance', requireAuth, validateRequest(maintenanceSchema), async (req, res) => {
    const body = req.body as Record<string, BodyValue>;
    const title = ensureString(body.title) as string;
    const description = ensureString(body.description) as string;
    const status = ensureString(body.status, 'Pending') as string;
    const priority = ensureString(body.priority, 'Medium') as string;
    const category = ensureString(body.category, 'General') as string;
    const unitId = ensureString(body.unitId) as string;
    const requestedBy = optionalString(body.requestedBy);
    const request = await prisma.maintenanceRequest.create({
      data: {
      cooperativeId: await getCoopId(req, prisma), title, description, status, priority, category, unitId, requestedBy }
    });
    res.json(request);
  });

  app.put('/api/maintenance/:id', requireAuth, validateRequest(maintenanceSchema.partial()), async (req, res) => {
    const body = req.body as Record<string, BodyValue>;
    const title = ensureString(body.title) as string;
    const description = ensureString(body.description) as string;
    const status = ensureString(body.status, 'Pending') as string;
    const priority = ensureString(body.priority, 'Medium') as string;
    const category = ensureString(body.category, 'General') as string;
    const unitId = ensureString(body.unitId) as string;
    const notes = body.notes;
    const expenses = body.expenses;
    try {
      const request = await prisma.maintenanceRequest.update({
        where: { id: req.params.id },
        data: { 
          title, 
          description, 
          status, 
          priority, 
          category, 
          unitId: optionalString(unitId),
          notes: notes ? (Array.isArray(notes) ? (notes as string[]) : [String(notes)]) : undefined,
          expenses: expenses ? (Array.isArray(expenses) ? (expenses as string[]) : [String(expenses)]) : undefined
        }
      });
      res.json(request);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/maintenance/:id', requireAuth, async (req, res) => {
    await prisma.maintenanceRequest.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  });

  app.get('/api/announcements', requireAuth, async (req, res) => {
    try {
      const announcements = await prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(announcements);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch announcements' });
    }
  });

  app.post('/api/announcements', requireAuth, validateRequest(announcementSchema), async (req, res) => {
    const body = req.body as Record<string, BodyValue>;
    const title = ensureString(body.title) as string;
    const content = ensureString(body.content) as string;
    const type = ensureString(body.type, 'General') as string;
    const priority = ensureString(body.priority, 'Normal') as string;
    const author = ensureString(body.author) as string;
    const date = ensureString(body.date) as string;
    const announcement = await prisma.announcement.create({
      data: {
      cooperativeId: await getCoopId(req, prisma), title, content, type, priority, author, date }
    });
    res.json(announcement);
  });

  app.put('/api/announcements/:id', requireAuth, validateRequest(announcementSchema.partial()), async (req, res) => {
    const body = req.body as Record<string, BodyValue>;
    const title = optionalString(body.title);
    const content = optionalString(body.content);
    const type = optionalString(body.type);
    const priority = optionalString(body.priority);
    const date = optionalString(body.date);
    
    const announcement = await prisma.announcement.update({
      where: { id: req.params.id },
      data: { 
        title, 
        content, 
        type, 
        priority, 
        date 
      }
    });
    res.json(announcement);
  });

  app.delete('/api/announcements/:id', requireAuth, async (req, res) => {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  });

  app.get('/api/documents', requireAuth, async (req, res) => {
    try {
      const documents = await prisma.document.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  app.post('/api/documents/upload', requireAuth, (req, res, next) => {
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

      const body = req.body as Record<string, BodyValue>;
      const title = ensureString(body.title, 'Untitled Document') as string;
      const category = ensureString(body.category, 'General') as string;
      const committee = optionalString(body.committee);
      console.log(`Metadata: Title="${title}", Category="${category}", Committee="${committee}"`);
      
      const currentYear = new Date().getFullYear().toString();
      
      // Get AI tags directly
      let aiTags: string[] = [];
      try {
        console.log('Requesting AI tags...');
        const genAI = getAI();
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
              },
              required: ['tags']
            }
          }
        });
        const result = await model.generateContent(`Analyze the following document content from a BC Housing Co-operative. Suggest 3-5 relevant semantic tags for categorization (e.g., "pets", "parking", "agm").\n\nContent: ${content.substring(0, 5000)}`);
        const response = await result.response;
        const aiData = JSON.parse(response.text() || '{"tags": []}');
        aiTags = aiData.tags || [];
        console.log('AI tags generated successfully.');
      } catch (aiErr: any) {
        console.error('AI tagging failed during upload:', aiErr.message);
      }
      const committeeTags = committee ? [committee] : [];
      const finalTags = Array.from(new Set([currentYear, ...committeeTags, ...(aiTags || [])]));

      console.log('Creating database record...');
      const document = await prisma.document.create({
          data: {
      cooperativeId: await getCoopId(req, prisma),
            title,
            category,
            tags: finalTags,
            url: '#', // Placeholder, in a real app this would be a file storage URL
          fileType: req.file.mimetype.split('/')[1] || 'unknown',
          author: (req as any).session?.user?.name || 'System',
          date: new Date().toISOString().split('T')[0],
          content: content || null,
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

  app.post('/api/documents', requireAuth, async (req, res) => {
    const body = req.body as Record<string, BodyValue>;
    const title = ensureString(body.title, 'Untitled Document') as string;
    const category = ensureString(body.category, 'General') as string;
    const url = ensureString(body.url, '#') as string;
    const fileType = ensureString(body.fileType, 'txt') as string;
    const author = ensureString(body.author, (req as any).session?.user?.name || 'System') as string;
    const date = ensureString(body.date, new Date().toISOString()) as string;
    const tags = body.tags ? ensureArray(body.tags) : [];
    const committee = optionalString(body.committee);
    const content = optionalString(body.content);

    const currentYear = new Date().getFullYear().toString();
    const committeeTags = committee ? [committee] : [];
    const finalTags = Array.from(new Set([currentYear, ...committeeTags, ...tags]));

    try {
      const document = await prisma.document.create({
        data: {
          cooperativeId: await getCoopId(req, prisma),
          title,
          category,
          url,
          fileType,
          author,
          date,
          tags: finalTags,
          committee: committee || null,
          content: content || null
        }
      });
      res.json(document);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/documents/:id', requireAuth, async (req, res) => {
    const body = req.body as Record<string, BodyValue>;
    const title = optionalString(body.title);
    const category = optionalString(body.category);
    const tags = body.tags ? ensureArray(body.tags) : undefined;
    const committee = optionalString(body.committee);
    const content = optionalString(body.content);
    
    try {
      const document = await prisma.document.update({
        where: { id: req.params.id },
        data: { 
          title, 
          category, 
          tags: tags ? { set: tags } : undefined, 
          committee: committee !== undefined ? (committee || null) : undefined,
          content 
        }
      });
      res.json(document);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  app.post('/api/admin/reindex-documents', requireAuth, async (req, res) => {
    try {
      const docs = await (prisma.document as any).findMany({
        where: { OR: [{ content: null }, { content: '' }] }
      });

      let updatedCount = 0;
      for (const doc of docs) {
        // Simple logic: if it's a gdoc or text file, try to fetch it
        if (doc.url.includes('google.com') && !doc.fileType.includes('pdf')) {
          try {
            // Note: This would ideally use a stored access token or a service account
            // For now, we'll just log that we found a target for indexing
            console.log(`Target for indexing: ${doc.title}`);
          } catch (err) {
            console.error(`Failed to index ${doc.title}:`, err);
          }
        }
      }

      res.json({ message: `Found ${docs.length} documents needing indexing.`, targetCount: docs.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/documents/:id', requireAuth, async (req, res) => {
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  });

  app.get('/api/committees', requireAuth, async (req, res) => {
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

  app.get('/api/events', requireAuth, async (req, res) => {
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

  app.post('/api/events', requireAuth, async (req, res) => {
    const body = req.body as Record<string, BodyValue>;
    const title = ensureString(body.title) as string;
    const description = ensureString(body.description) as string;
    const date = ensureString(body.date) as string;
    const time = ensureString(body.time) as string;
    const location = ensureString(body.location) as string;
    const category = ensureString(body.category, 'General') as string;
    
    const event = await prisma.coopEvent.create({
      data: {
      cooperativeId: await getCoopId(req, prisma), title, description, date, time, location, category },
      include: { attendees: true }
    });
    res.json(event);
  });

  app.put('/api/events/:id', requireAuth, async (req, res) => {
    const body = req.body as Record<string, BodyValue>;
    const title = ensureString(body.title) as string;
    const description = ensureString(body.description) as string;
    const date = ensureString(body.date) as string;
    const time = ensureString(body.time) as string;
    const location = ensureString(body.location) as string;
    const category = ensureString(body.category, 'General') as string;
    const event = await prisma.coopEvent.update({
      where: { id: req.params.id },
      data: { 
        title: optionalString(title),
        description: optionalString(description),
        date: optionalString(date),
        time: optionalString(time),
        location: optionalString(location),
        category: optionalString(category)
      },
      include: { attendees: true }
    });
    res.json(event);
  });

  app.post('/api/events/:id/attend', requireAuth, async (req, res) => {
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

  app.delete('/api/events/:id', requireAuth, async (req, res) => {
    await prisma.coopEvent.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  });

  // Dynamic Model Selection Cache
  let cachedBestModel: string | null = null;

  const getBestModelId = async (genAI: GoogleGenerativeAI): Promise<string> => {
    if (cachedBestModel) return cachedBestModel;

    try {
      console.log('Discovering available Gemini models...');
      const result = await genAI.listModels();
      const models = result.models || [];
      
      // Filter for models that support generating content
      const supportedModels = models.filter(m => 
        m.supportedMethods.includes('generateContent') && 
        !m.name.includes('vision') // Prefer newer multi-modal models over legacy vision-only
      );

      if (supportedModels.length === 0) {
        console.warn('No models found with generateContent support. Falling back to default.');
        return 'gemini-1.5-flash';
      }

      // Ranking priorities
      const priorities = [
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
        'gemini-1.5-pro-latest',
        'gemini-1.5-pro',
        'gemini-pro',
        'gemini-1.0-pro'
      ];

      for (const p of priorities) {
        const found = supportedModels.find(m => m.name.endsWith(p) || m.name === `models/${p}`);
        if (found) {
          cachedBestModel = found.name;
          console.log(`Dynamic selection: picked ${cachedBestModel}`);
          return cachedBestModel;
        }
      }

      // Fallback to the first available flash or pro model
      const fallback = supportedModels.find(m => m.name.includes('flash')) || 
                       supportedModels.find(m => m.name.includes('pro')) || 
                       supportedModels[0];
      
      cachedBestModel = fallback.name;
      console.log(`Dynamic selection (fallback): picked ${cachedBestModel}`);
      return cachedBestModel;
    } catch (e) {
      console.error('Error discovering models:', e);
      return 'gemini-1.5-flash'; // Hard fallback
    }
  };

  const getAI = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn('WARNING: Gemini API_KEY is missing from environment variables.');
    }
    return new GoogleGenerativeAI(apiKey || '');
  };

  app.post('/api/ai/triage', requireAuth, async (req, res) => {
    try {
      const genAI = getAI();
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              urgency: { type: SchemaType.STRING },
              category: { type: SchemaType.STRING },
              reasoning: { type: SchemaType.STRING }
            },
            required: ['urgency', 'category']
          }
        }
      });
      
      const body = req.body as Record<string, BodyValue>;
      const description = ensureString(body.description) as string;
      const result = await model.generateContent(`Evaluate the following maintenance request for a BC housing co-op and return a suggested urgency level (Low, Medium, High, Emergency) and a category (Plumbing, Electrical, Structural, Appliance, Other). Request: "${description}"`);
      const response = await result.response;
      res.json(JSON.parse(response.text() || '{}'));
    } catch (e: any) {
      res.status(500).json({ urgency: 'Medium', category: 'Other', error: e.message });
    }
  });

  app.post('/api/ai/policy', requireAuth, async (req, res) => {
    try {
      const genAI = getAI();
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const body = req.body as Record<string, BodyValue>;
      const question = ensureString(body.question) as string;
      const context = ensureString(body.context) as string;
      
      const result = await model.generateContent(`You are an AI assistant for a BC Housing Co-operative. Answer the following member question based on the provided policy context and your knowledge of BC co-operative housing law. If the answer isn't in the context, draw on general BC co-op principles but note that the member should verify with the board.\n\nContext: ${context}\nQuestion: ${question}`);
      const response = await result.response;
      res.json({ answer: response.text() || '' });
    } catch (e: any) {
      console.error(`[Policy Assistant Error]: ${e.message}`);
      if (e.stack) console.error(e.stack);
      res.status(500).json({ 
        answer: 'Unable to answer at this time. Please contact the board.', 
        error: e.message 
      });
    }
  });

  app.post('/api/ai/summarize', requireAuth, async (req, res) => {
    try {
      const genAI = getAI();
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const body = req.body as Record<string, BodyValue>;
      const content = ensureString(body.content) as string;
      
      const result = await model.generateContent(`Analyze the following document content from a BC Housing Co-operative. Provide a short summary (max 2 sentences) and suggest 3-5 relevant semantic tags for categorization (e.g., "pets", "parking", "agm").\n\nContent: ${content.substring(0, 5000)}`);
      const response = await result.response;
      res.json(JSON.parse(response.text() || '{"summary": "", "tags": []}'));
    } catch (e: any) {
      console.error('AI summarization failed:', e);
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

  app.get('/api/tenants/:id/history', requireAuth, async (req, res) => {
    try {
      const history = await prisma.tenantHistory.findMany({
        where: { tenantId: req.params.id },
        include: { unit: true },
        orderBy: { startDate: 'desc' }
      });
      res.json(history);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/units/:id/move-out', requireAuth, async (req, res) => {
    const body = req.body as Record<string, BodyValue>;
    const date = ensureString(body.date) as string;
    const reason = optionalString(body.reason);
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Identify all residents currently in the unit
        const residents = await tx.tenant.findMany({
          where: { unitId: req.params.id }
        });

        // 2. Clear unit's current occupancy status
        await tx.unit.update({
          where: { id: req.params.id },
          data: { status: 'Vacant', currentTenantId: null }
        });

        // 3. Process each resident for departure
        for (const resident of residents) {
          await tx.tenant.update({
            where: { id: resident.id },
            data: { status: 'Past', unitId: null }
          });

          // Terminate active history record for this unit
          const activeHistory = await tx.tenantHistory.findFirst({
            where: { tenantId: resident.id, unitId: req.params.id, endDate: null },
            orderBy: { startDate: 'desc' }
          });

          if (activeHistory) {
            await tx.tenantHistory.update({
              where: { id: activeHistory.id },
              data: { endDate: new Date(date), moveReason: reason || 'Household Move-out' }
            });
          } else {
            // Create archived history record if none existed (backfill)
            await tx.tenantHistory.create({
              data: {
                tenant: { connect: { id: resident.id } },
                unit: { connect: { id: req.params.id } },
                cooperative: { connect: { id: resident.cooperativeId } },
                startDate: new Date(resident.startDate || date),
                endDate: new Date(date),
                moveReason: reason || 'Household Move-out (Archived)'
              }
            });
          }
        }
      });
      res.json({ success: true });
    } catch (e: any) { 
      res.status(400).json({ error: e.message }); 
    }
  });

  app.post('/api/units/:id/move-in', requireAuth, async (req, res) => {
    const body = req.body as Record<string, BodyValue>;
    const tenantId = ensureString(body.tenantId) as string;
    const date = ensureString(body.date) as string;
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Mark unit as occupied by the new tenant
        await tx.unit.update({
          where: { id: req.params.id },
          data: { status: 'Occupied', currentTenantId: tenantId }
        });

        // 2. Update tenant's current residency details
        const updatedTenant = await tx.tenant.update({
          where: { id: tenantId },
          data: { status: 'Current', unitId: req.params.id, startDate: date }
        });

        // 3. Create a new residency history entry
        await tx.tenantHistory.create({
          data: {
            tenant: { connect: { id: tenantId } },
            unit: { connect: { id: req.params.id } },
            cooperative: { connect: { id: updatedTenant.cooperativeId } },
            startDate: new Date(date),
            moveReason: 'Move-in'
          }
        });
      });
      res.json({ success: true });
    } catch (e: any) { 
      res.status(400).json({ error: e.message }); 
    }
  });

  app.post('/api/units/:id/transfer', requireAuth, async (req, res) => {
    const body = req.body as Record<string, BodyValue>;
    const fromUnitId = ensureString(body.fromUnitId) as string;
    const toUnitId = ensureString(body.toUnitId) as string;
    const date = ensureString(body.date) as string;
    const tenantIds = ensureArray(body.tenantIds);
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Validate target unit availability
        const targetUnit = await tx.unit.findUnique({
          where: { id: toUnitId },
          include: { currentTenant: true }
        });

        if (!targetUnit) throw new Error('Target unit not found');
        if (targetUnit.status === 'Occupied' || targetUnit.currentTenantId) {
          throw new Error(`Target unit ${targetUnit.number} is currently occupied.`);
        }

        // 2. Identify residents to transfer
        // If tenantIds are provided, only move those individuals. Otherwise, move everyone in the unit.
        const residents = await tx.tenant.findMany({
          where: tenantIds ? { id: { in: tenantIds }, unitId: fromUnitId } : { unitId: fromUnitId }
        });

        if (residents.length === 0) {
          throw new Error('No residents found in source unit to transfer.');
        }

        // 3. Update source unit status if its primary tenant is moving or if all residents are moving
        const remainingResidents = await tx.tenant.count({ 
          where: { unitId: fromUnitId, NOT: { id: { in: residents.map(r => r.id) } } } 
        });

        if (remainingResidents === 0) {
          await tx.unit.update({
            where: { id: fromUnitId },
            data: { status: 'Vacant', currentTenantId: null }
          });
        }

        // 4. Update target unit status
        await tx.unit.update({
          where: { id: toUnitId },
          data: { status: 'Occupied', currentTenantId: residents[0].id }
        });

        // 5. Update each resident and their historical records
        for (const resident of residents) {
          await tx.tenant.update({
            where: { id: resident.id },
            data: { unitId: toUnitId, startDate: date }
          });

          // Terminate active history for the old unit
          const activeHistory = await tx.tenantHistory.findFirst({
            where: { tenantId: resident.id, unitId: fromUnitId, endDate: null },
            orderBy: { startDate: 'desc' }
          });
          
          if (activeHistory) {
            await tx.tenantHistory.update({
              where: { id: activeHistory.id },
              data: { endDate: new Date(date), moveReason: 'Internal Transfer' }
            });
          }

          // Initialize new history for the target unit
          await tx.tenantHistory.create({
            data: {
              tenant: { connect: { id: resident.id } },
              unit: { connect: { id: toUnitId } },
              cooperative: { connect: { id: resident.cooperativeId } },
              startDate: new Date(date),
              moveReason: 'Internal Transfer'
            }
          });
        }
      });

      res.json({ success: true });
    } catch (e: any) { 
      res.status(400).json({ error: e.message }); 
    }
  });

  app.get('/api/config', requireAuth, (req, res) => {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleApiKey: process.env.PICKER_API_KEY,
    });
  });

  app.use('/api/drive', requireAuth, driveRoutes);

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
