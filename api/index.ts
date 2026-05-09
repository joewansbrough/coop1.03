import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { z } from 'zod';
import axios from 'axios';
import cookieSession from 'cookie-session';
import multer from 'multer';
import { get, put, list } from '@vercel/blob';
import { Readable } from 'node:stream';
import { maintenanceSchema, documentSchema, announcementSchema, tenantSchema } from './validation.js';
import driveRoutes from './drive.js';
import { archiveMinutesPdf } from '../services/archiveMinutesPdf.js';
import {
  getStoredDashboardPreference,
  saveStoredDashboardPreference,
} from '../services/dashboardPreferenceStore.js';
import { type DashboardRole } from '../utils/dashboardPreferences.js';
import { createMaintenanceTriage } from '../utils/maintenanceAI.js';
import { detectOracleIntent, normalizeOracleLanguage } from '../utils/oracle.js';
import { mapMeetingActionsToNotifications } from '../utils/meetingAnalysis.js';
import { oracleTools, oracleToolDeclarations, ToolContext } from '../utils/oracleTools.js';
import { pcm16ToWavBuffer } from '../utils/audioWav.js';




const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const SESSION_SECRET = process.env.SESSION_SECRET || 'temporary-secret-key-change-me';
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const DEFAULT_GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const STABLE_GEMINI_FALLBACK_MODELS = [
  DEFAULT_GEMINI_MODEL,
  'gemini-3.1-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

const AI_INITIAL_TIMEOUT_MS = 4000; // First call should be fast
const AI_TOOL_TIMEOUT_MS = 3500;    // Tool calls give more room but still capped

/**
 * Helper to run a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label = 'Operation'): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

// Dynamic model registry
let activeModels: string[] = [...STABLE_GEMINI_FALLBACK_MODELS]; // Hard fallback
let lastModelUpdate = 0;
let modelRegistrySource: 'api' | 'fallback' = 'fallback';

const normalizeGeminiModelName = (name: string) => name.replace(/^models\//, '');

const rankGeminiModel = (model: string) => {
  const name = model.toLowerCase();
  let score = 0;
  if (name.includes('gemini')) score += 10;
  if (name.includes('flash-lite')) score += 70;
  else if (name.includes('flash')) score += 60;
  else if (name.includes('pro')) score += 45;
  if (name.includes('preview') || name.includes('experimental')) score -= 10;
  if (name.includes('latest')) score += 5;
  return score;
};

/**
 * Programmatically discovers and prioritizes the best available Gemini models.
 */
async function refreshModelRegistry() {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error('Gemini API_KEY is missing.');
    const response = await axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': apiKey },
      params: { pageSize: 1000 },
      timeout: 5000,
    });
    const available = response.data?.models || [];
    
    if (available.length > 0) {
      const validModels = available
        .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m: any) => normalizeGeminiModelName(String(m.name || '')))
        .filter(Boolean)
        .sort((a: string, b: string) => rankGeminiModel(b) - rankGeminiModel(a) || b.localeCompare(a));
      
      activeModels = Array.from(new Set([
        ...validModels,
        ...STABLE_GEMINI_FALLBACK_MODELS,
      ]));
      modelRegistrySource = 'api';
      console.log('[AI Registry] Discovered models:', activeModels);
    } else {
      activeModels = [...STABLE_GEMINI_FALLBACK_MODELS];
      modelRegistrySource = 'fallback';
      console.log('[AI Registry] Using curated fallback list:', activeModels);
    }
    lastModelUpdate = Date.now();
  } catch (err) {
    console.error('[AI Registry] Discovery failed, using current list:', err);
    activeModels = activeModels.length ? activeModels : [...STABLE_GEMINI_FALLBACK_MODELS];
    modelRegistrySource = 'fallback';
    lastModelUpdate = Date.now();
  }
}

const getBestModel = () => activeModels[0] || DEFAULT_GEMINI_MODEL;

/**
 * Executes a Gemini operation with automatic model fallback on 503/429 errors.
 */
async function withAiFallback<T>(
  operation: (modelName: string) => Promise<T>,
  preferredModel?: string
): Promise<T> {
  // Check available models up front on first use, then refresh daily.
  if (Date.now() - lastModelUpdate > 24 * 60 * 60 * 1000) {
    await refreshModelRegistry();
  }

  const modelsToTry = Array.from(new Set([
    ...(preferredModel && (modelRegistrySource === 'fallback' || activeModels.includes(preferredModel)) ? [preferredModel] : []),
    ...activeModels,
    ...STABLE_GEMINI_FALLBACK_MODELS,
  ]));
  
  let lastError: any;
  for (const modelName of modelsToTry) {
    try {
      return await operation(modelName);
    } catch (err: any) {
      const isModelUnavailable =
        err.message?.includes('404') ||
        err.message?.includes('not found') ||
        err.message?.includes('not supported for generateContent');
      const isTransient =
        err.message?.includes('503') || 
        err.message?.includes('429') || 
        err.message?.includes('high demand') ||
        err.message?.includes('overloaded') ||
        err.message?.includes('timed out');
      
      if ((isTransient || isModelUnavailable) && modelName !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[AI Fallback] Model ${modelName} failed (${err.message}). Trying next model...`);
        if (isModelUnavailable) activeModels = activeModels.filter(model => model !== modelName);
        continue;
      }
      lastError = err;
      break;
    }
  }
  throw lastError;
}

// Prisma singleton helper
let prismaInstance: PrismaClient;
const getPrisma = () => {
  if (!prismaInstance) {
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl) {
      console.log('DATABASE_URL protocol:', dbUrl.split(':')[0]);
    } else {
      console.error('DATABASE_URL is MISSING');
    }
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
};

const sanitizeUtf8 = (str: any) => {
  if (typeof str !== 'string') return str;
  return str.replace(/\0/g, '');
};

const getParam = (value: string | string[] | undefined): string => Array.isArray(value) ? value[0] ?? '' : value ?? '';

const getBlobToken = () => process.env.BLOB_READ_WRITE_TOKEN || process.env.coophub_READ_WRITE_TOKEN;

const isBlobStorageUrl = (value?: string | null) => Boolean(value?.includes('blob.vercel-storage.com'));

const getSafeDownloadName = (title: string, fileType?: string | null) => {
  const extension = fileType?.replace(/^\./, '') || 'pdf';
  const safeTitle = title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'document';
  return safeTitle.toLowerCase().endsWith(`.${extension.toLowerCase()}`) ? safeTitle : `${safeTitle}.${extension}`;
};

const getSafeBlobFileName = (fileName: string) =>
  fileName
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'document';

const handleSingleDocumentUpload = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  upload.single('file')(req, res, (error: any) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File is too large.', details: 'Document uploads are limited to 25 MB.' });
    }
    return res.status(400).json({ error: 'File upload failed.', details: error.message || String(error) });
  });
};

const getCoopId = async (req: any, p: any = getPrisma()) => {
  const user = (req as any).user || (req as any).session?.user;
  
  // 1. Direct session lookup (Most efficient)
  if (user?.cooperativeId) return user.cooperativeId;

  const email = user?.email;
  if (email) {
    const t = await p.tenant.findUnique({ where: { email: email.toLowerCase() } });
    if (t?.cooperativeId) {
      // Cache it in the session for subsequent requests in this session
      if ((req as any).session?.user) {
        (req as any).session.user.cooperativeId = t.cooperativeId;
      }
      return t.cooperativeId;
    }
  }

  // Fallback to first cooperative if none found
  const first = await p.cooperative.findFirst();
  if (!first) throw new Error("No cooperative found in the system.");
  
  // Cache the fallback too
  if ((req as any).session?.user) {
    (req as any).session.user.cooperativeId = first.id;
  }
  return first.id;
};

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

// Trust proxy for secure cookies on Vercel
app.set('trust proxy', true);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  const host = req.get('x-forwarded-host') || req.get('host') || '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

  cookieSession({
    name: 'session',
    keys: [SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: !isLocal, 
    sameSite: isLocal ? 'lax' : 'none',
    httpOnly: true,
    signed: true,
    overwrite: true,
  })(req, res, next);
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.coophub_READ_WRITE_TOKEN)
  });
});

// Authentication Middleware
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((req as any).session?.user) {
    (req as any).user = (req as any).session.user;
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
};

const getDashboardRole = (req: express.Request): DashboardRole =>
  ((req as any).user?.isAdmin || (req as any).session?.user?.isAdmin) ? 'admin' : 'resident';

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user || (req as any).session?.user;
  if (!user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
};

const normalizeNotification = (notification: any) => ({
  ...notification,
  isRead: Boolean(notification.readAt),
  timestamp: notification.createdAt,
});

const createSystemNotification = async (
  p: PrismaClient,
  data: {
    cooperativeId: string;
    audience: string;
    recipientUserEmail?: string | null;
    type: string;
    severity?: string;
    title: string;
    body: string;
    entityType?: string | null;
    entityId?: string | null;
    actionUrl?: string | null;
  },
) => p.notification.create({
  data: {
    cooperativeId: data.cooperativeId,
    audience: data.audience,
    recipientUserEmail: data.recipientUserEmail?.toLowerCase() || null,
    type: data.type,
    severity: data.severity || 'info',
    title: data.title,
    body: data.body,
    entityType: data.entityType || null,
    entityId: data.entityId || null,
    actionUrl: data.actionUrl || null,
  },
});

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

// Browser-safe configuration for Google Picker/OAuth client setup.
app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleApiKey: process.env.PICKER_API_KEY,
  });
});

app.get('/api/dashboard/preferences', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user || (req as any).session?.user;
    if (!user?.email) return res.status(401).json({ error: 'User session invalid' });

    const p = getPrisma();
    const preference = await getStoredDashboardPreference(p, {
      cooperativeId: await getCoopId(req, p),
      userEmail: user.email,
      role: getDashboardRole(req),
    });

    res.json(preference);
  } catch (error) {
    next(error);
  }
});

app.put('/api/dashboard/preferences', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user || (req as any).session?.user;
    if (!user?.email) return res.status(401).json({ error: 'User session invalid' });

    const p = getPrisma();
    const preference = await saveStoredDashboardPreference(p, {
      cooperativeId: await getCoopId(req, p),
      userEmail: user.email,
      role: getDashboardRole(req),
      preference: req.body,
    });

    res.json(preference);
  } catch (error) {
    next(error);
  }
});

app.get('/api/notifications', requireAuth, async (req, res, next) => {
  try {
    const p = getPrisma();
    const user = (req as any).user || (req as any).session?.user;
    const coopId = await getCoopId(req, p);
    const userEmail = user?.email?.toLowerCase();
    const where: any = {
      cooperativeId: coopId,
      OR: [
        { audience: 'all' },
        { audience: 'member' },
        ...(user?.isAdmin ? [{ audience: 'admin' }] : []),
        ...(userEmail ? [{ audience: 'user', recipientUserEmail: userEmail }] : []),
      ],
    };
    const notifications = await p.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications.map(normalizeNotification));
  } catch (error) {
    next(error);
  }
});

app.post('/api/notifications', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const p = getPrisma();
    const notification = await createSystemNotification(p, {
      cooperativeId: await getCoopId(req, p),
      audience: req.body.audience || 'admin',
      recipientUserEmail: req.body.recipientUserEmail,
      type: req.body.type || 'system',
      severity: req.body.severity || 'info',
      title: sanitizeUtf8(req.body.title || 'Notification'),
      body: sanitizeUtf8(req.body.body || ''),
      entityType: req.body.entityType,
      entityId: req.body.entityId,
      actionUrl: req.body.actionUrl,
    });
    res.json(normalizeNotification(notification));
  } catch (error) {
    next(error);
  }
});

app.put('/api/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const notificationId = getParam(req.params.id);
    const existing = await p.notification.findFirst({ where: { id: notificationId, cooperativeId: coopId } });
    if (!existing) return res.status(404).json({ error: 'Notification not found' });
    const notification = await p.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    res.json(normalizeNotification(notification));
  } catch (error) {
    next(error);
  }
});

app.put('/api/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const user = (req as any).user || (req as any).session?.user;
    const userEmail = user?.email?.toLowerCase();
    await p.notification.updateMany({
      where: {
        cooperativeId: coopId,
        readAt: null,
        OR: [
          { audience: 'all' },
          { audience: 'member' },
          ...(user?.isAdmin ? [{ audience: 'admin' }] : []),
          ...(userEmail ? [{ audience: 'user', recipientUserEmail: userEmail }] : []),
        ],
      },
      data: { readAt: new Date() },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
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
    const resolvedModel = DEFAULT_GEMINI_MODEL;

    (req as any).session = (req as any).session || {};
    (req as any).session.user = {
      email,
      name: userData.name,
      picture: userData.picture,
      isAdmin,
      tenantId: user?.id || null,
      unitNumber: user?.unit?.number || null,
      cooperativeId: user?.cooperativeId || null,
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


app.use('/api/drive', requireAuth, driveRoutes);

// --- Database API Routes ---

app.get('/api/units', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const units = await p.unit.findMany({
      where: { cooperativeId: coopId },
      include: {
        building: true,
        currentTenant: true,
        occupancyHistory: {
          include: { tenant: true },
          orderBy: { startDate: 'desc' }
        }
      }
    });
    res.json(units);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/buildings', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const buildings = await p.building.findMany({
      where: { cooperativeId: coopId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(buildings);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/buildings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const p = getPrisma();
    const building = await p.building.create({
      data: {
        cooperativeId: await getCoopId(req, p),
        name: sanitizeUtf8(req.body.name || 'Building'),
        code: sanitizeUtf8(req.body.code || null),
        address: sanitizeUtf8(req.body.address || null),
        sortOrder: Number(req.body.sortOrder || 1),
      },
    });
    res.json(building);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/units', requireAuth, requireAdmin, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const unit = await p.unit.create({
      data: {
        cooperativeId: coopId,
        number: sanitizeUtf8(req.body.number),
        type: sanitizeUtf8(req.body.type || '2BR'),
        floor: Number(req.body.floor || 1),
        status: sanitizeUtf8(req.body.status || 'Vacant'),
        buildingId: req.body.buildingId || null,
      },
      include: {
        building: true,
        currentTenant: true,
        occupancyHistory: {
          include: { tenant: true },
          orderBy: { startDate: 'desc' }
        }
      }
    });
    res.json(unit);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/units/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const unitId = getParam(req.params.id);
    const unit = await p.unit.update({
      where: { id: unitId },
      data: {
        ...(req.body.number !== undefined ? { number: sanitizeUtf8(req.body.number) } : {}),
        ...(req.body.type !== undefined ? { type: sanitizeUtf8(req.body.type) } : {}),
        ...(req.body.floor !== undefined ? { floor: Number(req.body.floor) } : {}),
        ...(req.body.status !== undefined ? { status: sanitizeUtf8(req.body.status) } : {}),
        ...(req.body.buildingId !== undefined ? { buildingId: req.body.buildingId || null } : {}),
      },
      include: { building: true, currentTenant: true },
    });
    if (unit.cooperativeId !== coopId) return res.status(403).json({ error: 'Forbidden' });
    res.json(unit);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/units/:id/scheduled-maintenance', requireAuth, async (req, res) => {
  try {
    const unitId = getParam(req.params.id);
    const tasks = await getPrisma().scheduledMaintenance.findMany({
      where: { unitId },
      orderBy: { dueDate: 'asc' }
    });
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tenants', requireAuth, validateRequest(tenantSchema), async (req, res) => {
  try {
    const tenant = await getPrisma().tenant.create({
      data: {
        ...req.body,
        cooperativeId: await getCoopId(req, getPrisma()),
        startDate: new Date(req.body.startDate),
      },
      include: { unit: true }
    });
    res.json(tenant);
  } catch (error: any) {
    console.error('Failed to create tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tenants', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const tenants = await p.tenant.findMany({
      where: { cooperativeId: coopId },
      include: { unit: true }
    });
    res.json(tenants);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tenants/:id/history', requireAuth, async (req, res) => {
  const tenantId = getParam(req.params.id);
  const history = await getPrisma().tenantHistory.findMany({
    where: { tenantId },
    include: { unit: true },
    orderBy: { startDate: 'desc' }
  });
  res.json(history);
});

// --- Unit Turnover Endpoints ---

app.post('/api/units/:id/move-out', requireAuth, async (req, res) => {
  const id = getParam(req.params.id);
  const { date, reason } = req.body;
  try {
    await getPrisma().$transaction(async (tx) => {
      // Find all current residents of this unit
      const residents = await tx.tenant.findMany({ where: { unitId: id, status: 'Current' } });

      for (const tenant of residents) {
        // Close any open TenantHistory record for this unit
        const openHistory = await tx.tenantHistory.findFirst({
          where: { tenantId: tenant.id, unitId: id, endDate: null },
          orderBy: { startDate: 'desc' }
        });
        if (openHistory) {
          await tx.tenantHistory.update({
            where: { id: openHistory.id },
            data: { endDate: new Date(date), moveReason: reason || 'Voluntary Household Departure' }
          });
        }
        // Mark tenant as Past and unlink from unit
        await tx.tenant.update({
          where: { id: tenant.id },
          data: { status: 'Past', unitId: null }
        });
      }

      // Mark unit as Vacant
      await tx.unit.update({
        where: { id },
        data: { status: 'Vacant', currentTenantId: null }
      });
    });

    res.json({ success: true });
  } catch (e: any) { 
    console.error('Move-out error:', e);
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/units/:id/move-in', requireAuth, async (req, res) => {
  const id = getParam(req.params.id);
  const { tenantId, date } = req.body;
  try {
    await getPrisma().$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new Error('Tenant not found');

      // If internal transfer: close open history record on their previous unit
      if (tenant.unitId && tenant.unitId !== id) {
        const openHistory = await tx.tenantHistory.findFirst({
          where: { tenantId, unitId: tenant.unitId, endDate: null },
          orderBy: { startDate: 'desc' }
        });
        if (openHistory) {
          await tx.tenantHistory.update({
            where: { id: openHistory.id },
            data: { endDate: new Date(date), moveReason: 'Internal Transfer' }
          });
        }
        // Vacate previous unit
        await tx.unit.update({
          where: { id: tenant.unitId },
          data: { status: 'Vacant', currentTenantId: null }
        });
      }

      // Create new TenantHistory record for the new unit
      await tx.tenantHistory.create({
        data: {
          tenantId: tenantId,
          unitId: id,
          cooperativeId: tenant.cooperativeId,
          startDate: new Date(date),
          moveReason: 'Move-In'
        }
      });

      // Update tenant
      await tx.tenant.update({
        where: { id: tenantId },
        data: { unitId: id, status: 'Current', startDate: new Date(date) }
      });

      // Update unit
      await tx.unit.update({
        where: { id },
        data: { status: 'Occupied', currentTenantId: tenantId }
      });
    });

    res.json({ success: true });
  } catch (e: any) { 
    console.error('Move-in error:', e);
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/units/:id/transfer', requireAuth, async (req, res) => {
  const id = getParam(req.params.id);
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

app.get('/api/maintenance', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const requests = await p.maintenanceRequest.findMany({
      where: { cooperativeId: coopId },
      include: { unit: true },
      orderBy: { createdAt: 'desc' }
    });
    // UI expects category as an array. The DB stores it as a comma-separated string or a single value.
    const mapped = requests.map(r => ({
      ...r,
      category: r.category ? (r.category.includes(', ') ? r.category.split(', ') : [r.category]) : []
    }));
    res.json(mapped);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/maintenance', requireAuth, async (req, res) => {
  const { title, description, status, priority, category, unitId, requestedBy, notes, attachments, aiTriage, visualDescription, residentTip } = req.body;
  const categoryString = Array.isArray(category) ? category.join(', ') : (category || 'General');
  
  try {
    const p = getPrisma();
    const user = (req as any).user;
    let tenantId = null;
    
    if (user?.email) {
      const t = await p.tenant.findUnique({ where: { email: user.email } });
      tenantId = t?.id || null;
    }

    const coopId = await getCoopId(req, p);
    const request = await p.maintenanceRequest.create({
      data: {
        cooperativeId: coopId,
        title,
        description,
        status: status || 'Pending',
        priority: priority || 'Medium',
        category: categoryString,
        unitId,
        tenantId: tenantId,
        requestedBy: requestedBy || user?.email,
        notes: notes || [],
        attachments: attachments || [],
        aiTriage: aiTriage || null,
        visualDescription: visualDescription || null,
        residentTip: residentTip || aiTriage?.residentTip || null,
      }
    });
    await createSystemNotification(p, {
      cooperativeId: coopId,
      audience: 'admin',
      type: 'maintenance',
      severity: request.priority === 'Emergency' ? 'urgent' : request.priority === 'High' ? 'high' : 'info',
      title: `New ${request.priority} maintenance request`,
      body: request.title || request.description,
      entityType: 'maintenance',
      entityId: request.id,
      actionUrl: `/admin/maintenance/${request.id}`,
    }).catch(error => console.error('Failed to create maintenance notification:', error));

    res.json({
      ...request,
      category: request.category ? request.category.split(', ') : [],
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/maintenance/:id', requireAuth, async (req, res) => {
  const body = req.body;
  
  const data: any = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.status !== undefined) data.status = body.status;
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.category !== undefined) {
    data.category = Array.isArray(body.category) ? body.category.join(', ') : String(body.category);
  }
  if (body.unitId !== undefined) data.unitId = body.unitId;
  if (body.requestedBy !== undefined) data.requestedBy = body.requestedBy;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.expenses !== undefined) data.expenses = body.expenses;
  if (body.attachments !== undefined) data.attachments = body.attachments;
  if (body.aiTriage !== undefined) data.aiTriage = body.aiTriage;
  if (body.visualDescription !== undefined) data.visualDescription = body.visualDescription;
  if (body.residentTip !== undefined) data.residentTip = body.residentTip;
  if (body.triageReviewedBy !== undefined) data.triageReviewedBy = body.triageReviewedBy;
  if (body.triageReviewedAt !== undefined) data.triageReviewedAt = body.triageReviewedAt ? new Date(body.triageReviewedAt) : null;

  try {
    const maintenanceId = getParam(req.params.id);
    const p = getPrisma();
    const previous = await p.maintenanceRequest.findUnique({ where: { id: maintenanceId } });
    const request = await p.maintenanceRequest.update({
      where: { id: maintenanceId },
      data
    });
    if (previous?.status !== request.status) {
      await createSystemNotification(p, {
        cooperativeId: request.cooperativeId,
        audience: 'user',
        recipientUserEmail: request.requestedBy,
        type: 'maintenance',
        severity: request.status === 'Completed' ? 'info' : 'medium',
        title: 'Maintenance request updated',
        body: `${request.title} is now ${request.status}.`,
        entityType: 'maintenance',
        entityId: request.id,
        actionUrl: `/maintenance/${request.id}`,
      }).catch(error => console.error('Failed to create maintenance status notification:', error));
    }
    res.json({
      ...request,
      category: request.category ? request.category.split(', ') : [],
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


app.delete('/api/maintenance/:id', requireAuth, async (req, res) => {
  const maintenanceId = getParam(req.params.id);
  await getPrisma().maintenanceRequest.delete({ where: { id: maintenanceId } });
  res.json({ success: true });
});

app.get('/api/announcements', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const announcements = await p.announcement.findMany({
      where: { cooperativeId: coopId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(announcements);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/announcements', requireAuth, async (req, res) => {
  const { title, content, type, priority, author, date } = req.body;
  try {
    const p = getPrisma();
    const announcement = await p.announcement.create({
      data: {
        cooperativeId: await getCoopId(req, p), title, content, type, priority, author, date }
    });
    res.json(announcement);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/announcements/:id', requireAuth, async (req, res) => {
  const { title, content, type, priority, date } = req.body;
  try {
    const announcementId = getParam(req.params.id);
    const announcement = await getPrisma().announcement.update({
      where: { id: announcementId },
      data: { title, content, type, priority, date }
    });
    res.json(announcement);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/announcements/:id', requireAuth, async (req, res) => {
  try {
    const announcementId = getParam(req.params.id);
    await getPrisma().announcement.delete({ where: { id: announcementId } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/documents', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const documents = await p.document.findMany({
      where: { cooperativeId: coopId },
      orderBy: { createdAt: 'desc' },
      include: { currentVersion: true }
    });
    res.json(documents);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/upload-to-blob', requireAuth, handleSingleDocumentUpload, async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file was uploaded.' });

    const token = getBlobToken();
    if (!token) {
      return res.status(500).json({ error: 'Blob storage is not configured for document uploads.' });
    }

    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const title = sanitizeUtf8(req.body.title) || file.originalname || 'Untitled Document';
    const category = sanitizeUtf8(req.body.category) || 'General';
    const committee = sanitizeUtf8(req.body.committee) || '';
    const fileType = file.originalname.includes('.') ? file.originalname.split('.').pop()?.toLowerCase() || 'bin' : 'bin';
    const storageKey = `coops/${coopId}/documents/${Date.now()}-${getSafeBlobFileName(file.originalname || title)}`;

    const blob = await put(storageKey, file.buffer, {
      access: process.env.BLOB_ACCESS === 'public' ? 'public' : 'private',
      contentType: file.mimetype || 'application/octet-stream',
      token,
    });

    const tags = Array.from(new Set([
      new Date().getFullYear().toString(),
      ...(committee ? [committee] : []),
      category,
    ].filter(Boolean)));

    const document = await p.$transaction(async (tx) => {
      const createdDocument = await tx.document.create({
        data: {
          cooperativeId: coopId,
          title,
          category,
          url: blob.url,
          fileType,
          author: ((req as any).user?.name || 'Admin'),
          date: new Date(),
          tags,
          committee,
          content: null,
        } as any,
      });

      const version = await tx.documentVersion.create({
        data: {
          documentId: createdDocument.id,
          cooperativeId: coopId,
          version: 1,
          source: 'upload',
          storageUrl: blob.url,
          storageKey: blob.pathname || storageKey,
          fileType,
          mimeType: file.mimetype || 'application/octet-stream',
          sizeBytes: file.size,
        },
      });

      await tx.documentIngestionJob.create({
        data: {
          documentId: createdDocument.id,
          documentVersionId: version.id,
          cooperativeId: coopId,
          status: 'queued',
        },
      });

      return tx.document.update({
        where: { id: createdDocument.id },
        data: { currentVersionId: version.id },
        include: { currentVersion: true },
      });
    });

    res.json({ document });
  } catch (e: any) {
    console.error('Document upload error:', e);
    res.status(500).json({ error: 'Failed to upload document.', details: e.message });
  }
});

app.post('/api/documents', requireAuth, async (req, res) => {
  const { title, category, url, fileType, author, date, tags, committee, content } = req.body;

  try {
    const p = getPrisma();
    // Tag generation temporarily disabled for basic metadata sync
    const currentYear = new Date().getFullYear().toString();
    const committeeTags = committee ? [committee] : [];
    const providedTags = Array.isArray(tags) ? tags : [];
    const finalTags = Array.from(new Set([currentYear, ...committeeTags, ...providedTags]));

    const document = await p.document.create({
      data: {
        cooperativeId: await getCoopId(req, p),
        title: title || 'Untitled Document',
        category: category || 'General',
        url: url || '#',
        fileType: fileType || 'txt',
        author: author || ((req as any).user?.name || 'System'),
        date: date || new Date().toISOString(),
        tags: finalTags,
        committee: committee || null,
        content: content || null,
      } as any
    });
    res.json(document);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/documents/:id/original', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const documentId = getParam(req.params.id);
    const document = await p.document.findFirst({
      where: { id: documentId, cooperativeId: coopId },
      include: { currentVersion: true },
    });

    if (!document) return res.status(404).json({ error: 'Document not found' });

    const blobReference = document.currentVersion?.storageKey || document.currentVersion?.storageUrl || (isBlobStorageUrl(document.url) ? document.url : null);
    if (!blobReference && document.url && document.url !== '#') {
      return res.redirect(document.url);
    }
    if (!blobReference) return res.status(404).json({ error: 'Original file is not available.' });

    const token = getBlobToken();
    if (!token) {
      return res.status(500).json({ error: 'Blob storage is not configured for document retrieval.' });
    }

    const blob = await get(blobReference, {
      access: process.env.BLOB_ACCESS === 'public' ? 'public' : 'private',
      token,
    });

    if (!blob || blob.statusCode === 304 || !blob.stream) {
      return res.status(404).json({ error: 'Original file is not available.' });
    }

    const fileName = getSafeDownloadName(document.title, document.fileType);
    const disposition = req.query.download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', blob.blob.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(blob.blob.size));
    res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
    Readable.fromWeb(blob.stream as any).pipe(res);
  } catch (e: any) {
    console.error('Document original retrieval error:', e);
    res.status(500).json({ error: 'Failed to retrieve original document.', details: e.message });
  }
});

app.put('/api/documents/:id', requireAuth, async (req, res) => {
  const { title, category, tags, committee, content } = req.body;
  try {
    const documentId = getParam(req.params.id);
    const document = await getPrisma().document.update({
      where: { id: documentId },
      data: { 
        title, 
        category, 
        tags: tags ? { set: tags } : undefined, 
        committee: committee !== undefined ? (committee || '') : undefined,
        content 
      } as any,
      include: { currentVersion: true }
    });
    res.json(document);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/documents/:id', requireAuth, async (req, res) => {
  try {
    const documentId = getParam(req.params.id);
    await getPrisma().document.delete({ where: { id: documentId } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/committees', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const committees = await p.committee.findMany({
      where: { cooperativeId: coopId },
      include: { 
        members: true,
        events: true 
      }
    });
    // UI expects members as an array of name strings
    const mapped = committees.map(c => ({
      ...c,
      members: c.members.map((m: any) => `${m.firstName} ${m.lastName}`)
    }));
    res.json(mapped);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/events', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const events = await p.coopEvent.findMany({
      where: { cooperativeId: coopId },
      include: { attendees: true },
      orderBy: { date: 'asc' }
    });
    res.json(events);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/events', requireAuth, async (req, res) => {
  const { title, description, date, time, location, category, committeeId } = req.body;
  const event = await getPrisma().coopEvent.create({
    data: {
      cooperativeId: await getCoopId(req, getPrisma()), 
      title, 
      description, 
      date: new Date(date), 
      time, 
      location, 
      category,
      committeeId: committeeId || null
    },
    include: { attendees: true }
  });
  res.json(event);
});

app.put('/api/events/:id', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const { title, description, date, time, location, category, committeeId } = req.body;
    const eventId = getParam(req.params.id);
    const coopId = await getCoopId(req, p);
    const existingEvent = await p.coopEvent.findFirst({
      where: { id: eventId, cooperativeId: coopId },
    });
    if (!existingEvent) return res.status(404).json({ error: 'Event not found' });

    const event = await p.coopEvent.update({
      where: { id: eventId },
      data: {
        title,
        description,
        date: new Date(date),
        time,
        location,
        category,
        committeeId: committeeId || null,
      },
      include: { attendees: true },
    });
    res.json(event);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/events/:id/attend', requireAuth, async (req, res) => {
  const user = (req as any).user || (req as any).session?.user;
  if (!user || !user.email) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const p = getPrisma();
    const eventId = getParam(req.params.id);
    const coopId = await getCoopId(req, p);
    const userEmail = String(user.email).toLowerCase();
    const tenant = await p.tenant.findFirst({
      where: {
        cooperativeId: coopId,
        OR: [
          { email: user.email },
          { email: userEmail },
        ],
      },
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant record not found for this user' });

    const existingEvent = await p.coopEvent.findFirst({
      where: { id: eventId, cooperativeId: coopId },
      include: { attendees: true },
    });
    if (!existingEvent) return res.status(404).json({ error: 'Event not found' });
    if (existingEvent.attendees.some((attendee: any) => attendee.id === tenant.id)) {
      return res.json(existingEvent);
    }

    const event = await p.coopEvent.update({
      where: { id: eventId },
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
  const eventId = getParam(req.params.id);
  await getPrisma().coopEvent.delete({ where: { id: eventId } });
  res.json({ success: true });
});

// --- Meeting Minutes Routes ---

const serializeMinutes = (minutes: any) => minutes ? ({
  ...minutes,
  formData: minutes.data,
}) : minutes;

app.get('/api/minutes', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const minutes = await p.meetingMinutes.findMany({
      where: { cooperativeId: coopId },
      orderBy: { createdAt: 'desc' },
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            date: true,
            category: true,
          },
        },
      },
    });
    res.json(minutes.map(serializeMinutes));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/minutes/:meetingId', requireAuth, async (req, res) => {
  try {
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const meetingId = getParam(req.params.meetingId);
    const minutes = await p.meetingMinutes.findUnique({
      where: { meetingId },
    });
    if (!minutes) return res.status(404).json({ error: 'Minutes not found' });
    
    // Security check: ensure minutes belong to user's coop
    if (minutes.cooperativeId && minutes.cooperativeId !== coopId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    res.json(serializeMinutes(minutes));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/minutes/:meetingId', requireAuth, async (req, res) => {
  try {
    const meetingId = getParam(req.params.meetingId);
    const { meetingType, formData, attendees, motions } = req.body;
    const minutesData = formData ?? req.body.data;
    const user = (req as any).user;
    const p = getPrisma();
    const coopId = await getCoopId(req, p);

    console.log(`Saving minutes for meeting ${meetingId}. User: ${user?.email}, Coop: ${coopId}`);

    if (!user?.email) {
      console.error('Minutes Save Error: No user email in session');
      return res.status(401).json({ error: 'User session invalid' });
    }

    // UPSERT pattern for minutes
    const existing = await p.meetingMinutes.findUnique({ where: { meetingId } });

    if (existing) {
      const updated = await p.meetingMinutes.update({
        where: { meetingId },
        data: {
          meetingType,
          data: minutesData,
          attendees,
          motions,
          cooperativeId: coopId,
          updatedAt: new Date(),
        }
      });
      return res.json(serializeMinutes(updated));
    }

    const minutes = await p.meetingMinutes.create({
      data: {
        meetingId,
        meetingType,
        data: minutesData,
        attendees,
        motions,
        cooperativeId: coopId,
        createdBy: user.email,
      }
    });

    res.status(201).json(serializeMinutes(minutes));
  } catch (error: any) {
    console.error('Error saving minutes:', error);
    res.status(500).json({ error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  }
});

app.post('/api/minutes/:meetingId/library-pdf', requireAuth, async (req, res) => {
  try {
    const meetingId = getParam(req.params.meetingId);
    const { pdfDataUrl, title, date } = req.body;
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const user = (req as any).user || (req as any).session?.user;

    const document = await archiveMinutesPdf({
      prisma: p,
      putBlob: put,
      meetingId,
      cooperativeId: coopId,
      user,
      pdfDataUrl,
      title,
      date,
      blobToken: process.env.BLOB_READ_WRITE_TOKEN || process.env.coophub_READ_WRITE_TOKEN,
      blobAccess: process.env.BLOB_ACCESS === 'public' ? 'public' : 'private',
    });
    res.json(document);
  } catch (error: any) {
    console.error('Error archiving minutes PDF:', error);
    const status = error.message === 'A PDF data URL is required.' ? 400
      : error.message === 'Meeting not found for this cooperative.' ? 404
        : 500;
    res.status(status).json({ error: error.message });
  }
});

// --- AI Routes ---
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn('WARNING: Gemini API_KEY is missing from environment variables.');
  }
  return new GoogleGenerativeAI(apiKey || '');
};

const parseJsonResponse = (text: string, fallback: any = {}) => {
  try {
    return JSON.parse(text || JSON.stringify(fallback));
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : fallback;
  }
};

const asArray = (value: any) => Array.isArray(value) ? value : [];

const extractCitationsFromToolResults = (toolResponses: any[]) => {
  const results = toolResponses
    .map(item => item?.functionResponse?.response?.result)
    .filter(Boolean);
  
  const docs = results.flatMap(result => [
    ...asArray(result.documents),
    ...asArray(result.knowledge?.documents),
    ...(Array.isArray(result) ? result.filter((item: any) => item?.documentId || item?.id) : []),
  ]);
  
  const citations = docs.map((doc: any) => ({
    title: doc.documentTitle || doc.title,
    documentId: doc.documentId || doc.id,
    pageNumber: doc.pageNumber
  })).filter(c => c.title);
  
  const seen = new Set();
  return citations.filter(c => {
    const key = c.documentId || c.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const createOracleAnswerFromToolResults = (question: string, toolResponses: any[], fallbackAnswer: string) => {
  const normalizedQuestion = String(question || '').toLowerCase();
  const results = toolResponses
    .map(item => item?.functionResponse?.response?.result)
    .filter(Boolean);
  const committees = results.flatMap(result => asArray(result.committees || result)).filter(c => c.name);
  const announcements = results.flatMap(result => [
    ...asArray(result.announcements),
    ...asArray(result.documentAnnouncements),
    ...(Array.isArray(result) ? result.filter((item: any) => item?.title && item?.content) : []),
  ]);
  const documents = results.flatMap(result => [
    ...asArray(result.documents),
    ...(Array.isArray(result) ? result.filter((item: any) => item?.documentTitle || item?.title) : []),
  ]);

  if (normalizedQuestion.includes('committee')) {
    const target = committees.find((committee: any) => {
      const name = String(committee?.name || '').toLowerCase();
      return normalizedQuestion.split(/\s+/).some(word => word.length > 3 && name.includes(word));
    }) || (normalizedQuestion.includes('all') ? null : committees[0]);

    if (normalizedQuestion.includes('all')) {
      const list = committees.map((c: any) => `- ${c.name} (Chair: ${c.chairName || c.chair || 'Unknown'})`).join('\n');
      if (list) return `Here are the co-op committees:\n${list}`;
    }

    if (target?.name) {
      const chair = target.chairName || target.chair;
      if (normalizedQuestion.includes('chair')) {
        return chair ? `${chair} is the chair of the ${target.name}.` : `The chair of the ${target.name} is not listed.`;
      }
      return `${target.name} is led by ${chair || 'an unlisted chair'}. ${target.description || ''}`;
    }
  }

  const policyMatches = [...announcements, ...documents].filter((item: any) => {
    const searchable = `${item?.title || item?.documentTitle || ''} ${item?.content || item?.text || ''}`.toLowerCase();
    return normalizedQuestion.split(/\s+/).some(word => word.length > 3 && searchable.includes(word));
  });
  const bestPolicyMatch = policyMatches[0];
  if (bestPolicyMatch) {
    const title = bestPolicyMatch.title || bestPolicyMatch.documentTitle || 'A matching co-op record';
    const content = String(bestPolicyMatch.content || bestPolicyMatch.text || '').trim();
    const sentence = content.split(/(?<=[.!?])\s+/)[0] || content.slice(0, 180);
    return sentence ? `${title}: ${sentence}` : `${title} appears to be the most relevant co-op record.`;
  }

  return fallbackAnswer;
};

app.post('/api/ai/triage', requireAuth, async (req, res) => {
  try {
    const { description, visualDescription } = req.body;
    if (!description || String(description).trim().length < 10) {
      return res.status(400).json({ error: 'A detailed description is required.' });
    }
    const genAI = getAI();
    const user = (req as any).user || (req as any).session?.user;
    const resolvedModel = user?.geminiModel || DEFAULT_GEMINI_MODEL;
    const triage = await withAiFallback(async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              priority: { type: SchemaType.STRING },
              urgency: { type: SchemaType.STRING },
              category: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              residentTip: { type: SchemaType.STRING },
              confidence: { type: SchemaType.NUMBER },
              safetyWarning: { type: SchemaType.STRING },
              reasoning: { type: SchemaType.STRING },
            },
            required: ['priority', 'urgency', 'category', 'residentTip', 'confidence']
          }
        }
      });
      const result = await model.generateContent(`Evaluate this BC housing co-op maintenance request. Return JSON only. Categories must be from Plumbing, Electrical, Structural, Appliance, HVAC, Exterior, Safety, Other. Priority and urgency must be Low, Medium, High, or Emergency. Provide a short residentTip that is helpful but does not diagnose beyond the evidence. Description: "${description}"${visualDescription ? `\nPhoto description: "${visualDescription}"` : ''}`);
      const response = await result.response;
      return createMaintenanceTriage(parseJsonResponse(response.text(), {}));
    }, resolvedModel);
    res.json(triage);
  } catch (e: any) {
    res.status(500).json({ error: `Gemini maintenance triage failed: ${e.message}` });
  }
});

app.post('/api/ai/triage-demo', async (req, res) => {
  try {
    const { description, visualDescription } = req.body;
    if (!description || String(description).trim().length < 10) {
      return res.status(400).json({ error: 'A detailed description is required.' });
    }
    const model = getAI().getGenerativeModel({
      model: DEFAULT_GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            priority: { type: SchemaType.STRING },
            urgency: { type: SchemaType.STRING },
            category: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            residentTip: { type: SchemaType.STRING },
            confidence: { type: SchemaType.NUMBER },
            safetyWarning: { type: SchemaType.STRING },
            reasoning: { type: SchemaType.STRING },
          },
          required: ['priority', 'urgency', 'category', 'residentTip', 'confidence']
        }
      }
    });
    const result = await model.generateContent(`Evaluate this BC housing co-op maintenance request. Return JSON only. Categories must be from Plumbing, Electrical, Structural, Appliance, HVAC, Exterior, Safety, Other. Priority and urgency must be Low, Medium, High, or Emergency. Provide a short residentTip that is helpful but does not diagnose beyond the evidence. Description: "${description}"${visualDescription ? `\nPhoto description: "${visualDescription}"` : ''}`);
    const response = await result.response;
    res.json(createMaintenanceTriage(parseJsonResponse(response.text(), {})));
  } catch (e: any) {
    res.status(500).json({ error: `Gemini maintenance triage failed: ${e.message}` });
  }
});

app.post('/api/ai/maintenance-image-description', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'An image upload is required.' });
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const p = getPrisma();
    const coopId = await getCoopId(req, p);
    const token = getBlobToken();
    const storageKey = `coops/${coopId}/maintenance/${Date.now()}-${getSafeBlobFileName(file.originalname || 'maintenance-photo')}`;
    const blob = token
      ? await put(storageKey, file.buffer, {
        access: process.env.BLOB_ACCESS === 'public' ? 'public' : 'private',
        token,
        contentType: file.mimetype,
        addRandomSuffix: false,
      })
      : null;
    const genAI = getAI();
    const user = (req as any).user || (req as any).session?.user;
    const resolvedModel = user?.geminiModel || DEFAULT_GEMINI_MODEL;
    const imageAnalysis = await withAiFallback(async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' },
      });
      const result = await model.generateContent([
        {
          text: `Describe this maintenance photo for a visually impaired resident. Use the resident's written problem description as context when it helps interpret the image, but do not claim visual details unless they are visible. Return JSON with visualDescription, observedDamage, likelyCategory, safetyConcerns, confidence. Do not identify people or private documents.${description ? `\n\nResident problem description: ${description}` : ''}`,
        },
        {
          inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: file.mimetype,
          },
        },
      ]);
      const response = await result.response;
      return parseJsonResponse(response.text(), {
        visualDescription: 'The image could not be analyzed.',
        observedDamage: '',
        likelyCategory: 'Other',
        safetyConcerns: '',
        confidence: 0,
      });
    }, resolvedModel);
    res.json({
      ...imageAnalysis,
      attachment: blob ? {
        id: `maintenance-attachment-${Date.now()}`,
        fileName: file.originalname || 'maintenance-photo',
        url: blob.url,
        storageUrl: blob.url,
        storageKey: blob.pathname || storageKey,
        contentType: file.mimetype,
        size: file.size,
        visualDescription: imageAnalysis.visualDescription || '',
        uploadedAt: new Date().toISOString(),
      } : undefined,
      attachmentUploadError: token ? undefined : 'Blob storage is not configured for maintenance image uploads.',
    });
  } catch (e: any) {
    res.status(500).json({
      visualDescription: 'The image could not be analyzed at this time.',
      observedDamage: '',
      likelyCategory: 'Other',
      safetyConcerns: '',
      confidence: 0,
      error: e.message,
    });
  }
});

app.post('/api/ai/maintenance-image-description-demo', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'An image upload is required.' });
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const model = getAI().getGenerativeModel({
      model: DEFAULT_GEMINI_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const result = await model.generateContent([
      {
        text: `Describe this maintenance photo for a visually impaired resident. Use the resident's written problem description as context when it helps interpret the image, but do not claim visual details unless they are visible. Return JSON with visualDescription, observedDamage, likelyCategory, safetyConcerns, confidence. Do not identify people or private documents.${description ? `\n\nResident problem description: ${description}` : ''}`,
      },
      {
        inlineData: {
          data: file.buffer.toString('base64'),
          mimeType: file.mimetype,
        },
      },
    ]);
    const response = await result.response;
    const imageAnalysis = parseJsonResponse(response.text(), {
      visualDescription: '',
      observedDamage: '',
      likelyCategory: 'Other',
      safetyConcerns: '',
      confidence: 0,
    });
    res.json({
      ...imageAnalysis,
      attachment: {
        id: `demo-maintenance-attachment-${Date.now()}`,
        fileName: file.originalname || 'maintenance-photo',
        contentType: file.mimetype,
        size: file.size,
        visualDescription: imageAnalysis.visualDescription || '',
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: `Gemini maintenance image analysis failed: ${e.message}` });
  }
});

app.post('/api/ai/policy', requireAuth, async (req, res) => {
  try {
    const genAI = getAI();
    const user = (req as any).user || (req as any).session?.user;
    const resolvedModel = user?.geminiModel || DEFAULT_GEMINI_MODEL;
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

app.post('/api/oracle/query-demo', async (req, res) => {
  const startedAt = Date.now();
  const { question, language, pageContext, demoUser } = req.body;
  if (!question || String(question).trim().length < 2) return res.status(400).json({ error: 'Question is required.' });
  const normalizedLanguage = normalizeOracleLanguage(language);
  const intent = detectOracleIntent(question);
  const p = getPrisma();

  try {
    // In demo mode, we use the first cooperative we find
    const firstCoop = await p.cooperative.findFirst();
    const coopId = firstCoop?.id || 'demo-coop-id';

    const isDemoAdmin = demoUser?.isAdmin !== false;
    const demoEmail = typeof demoUser?.email === 'string' && demoUser.email.includes('@')
      ? demoUser.email
      : 'margaret.chen@email.com';
    const demoRole = isDemoAdmin ? 'ADMIN' : 'MEMBER';

    // Demo Tool Context
    const toolContext: ToolContext = {
      prisma: p,
      cooperativeId: coopId,
      userId: demoUser?.tenantId || demoUser?.id || 'demo-user-id',
      userEmail: demoEmail,
      role: demoRole,
      isAdmin: isDemoAdmin
    };

    const genAI = getAI();
    
    const oracleResponse = await withAiFallback(async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        tools: [{ functionDeclarations: oracleToolDeclarations as any }]
      });

      const chat = model.startChat();
      
      const prompt = `You are the Co-op Oracle for a BC housing co-op DEMO environment. Answer in ${normalizedLanguage}. 
You have access to tools that query the demo database. Use them to provide accurate answers.

Database coverage:
- Use get_database_schema when you need to see the complete tool and model map.
- You can retrieve co-op profile, buildings, units, tenants, maintenance, scheduled maintenance, notifications, announcements, documents, document chunks, document ingestion status, document access logs, events, committees, meeting minutes, meeting analyses, Oracle query history, and dashboard preferences.
- All tools enforce cooperative scoping and user permissions. If a tool returns an access error, explain that the information is not available to this user.
- 'open' maintenance requests = status 'Pending' or 'In Progress'.

Reasoning:
- Use tools before answering factual questions about co-op records, policies, members, units, meetings, or maintenance.
- For broad factual questions, use search_coop_database first so the whole permission-accessible database can inform the answer.
- For policy questions, use search_coop_knowledge first; it searches document text and announcements together.
- Chain tools when needed, for example committee -> chair/member -> tenant -> unit.
- Prefer specific filtered calls over broad calls.
- If a tool returns usable records plus errors, answer from the usable records and do not say the tool failed.
- Only mention a failed lookup when no usable records were returned for the member's question.
Role: ${demoRole} (Demo Mode, isAdmin: ${isDemoAdmin}).
Page context: ${pageContext || 'none'}.

Answer style:
- Use plain, resident-friendly language by default.
- Be concise: usually 2-4 short sentences.
- Use bullets only when they make the answer easier to scan.
- Avoid legal jargon and long policy explanations unless the member asks for detail.
- If the question is urgent, safety-related, or legal, say what to do next and advise checking with the board or emergency services as appropriate.

Return JSON:
{
  "answer": "...",
  "confidence": 0.9,
  "intent": "maintenance" | "governance" | "policy" | "general",
  "suggestedAction": { "type": "...", "label": "...", "href": "..." } (optional)
}

Member Question: ${question}`;

      let result = await withTimeout(chat.sendMessage(prompt), AI_INITIAL_TIMEOUT_MS, 'Demo Initial sendMessage');
      let response = result.response;
      
      let callCount = 0;
      const MAX_CALLS = 2; // Strict limit for speed
      const allToolResponses: any[] = [];

      while (response.functionCalls()?.length && callCount < MAX_CALLS) {
        callCount++;
        const toolCalls = response.functionCalls() || [];
        
        // Execute all tool calls in this turn in parallel
        const toolResponses = await Promise.all(toolCalls.map(async (call) => {
          const toolName = call.name as keyof typeof oracleTools;
          const toolHandler = oracleTools[toolName];
          
          if (toolHandler) {
            try {
              const toolResult = await (toolHandler as any)(toolContext, call.args || {});
              return {
                functionResponse: {
                  name: toolName,
                  response: { result: toolResult }
                }
              };
            } catch (err: any) {
              return {
                functionResponse: {
                  name: toolName,
                  response: { error: err.message, toolName }
                }
              };
            }
          }
          return {
            functionResponse: {
              name: toolName,
              response: { error: "Tool not found" }
            }
          };
        }));

        if (toolResponses.length > 0) {
          allToolResponses.push(...toolResponses);
          result = await withTimeout(chat.sendMessage(toolResponses), AI_TOOL_TIMEOUT_MS, `Demo ToolResponse turn ${callCount}`);
          response = result.response;
        } else {
          break;
        }
      }

      const responseText = response.text();
      const fallbackAnswer = createOracleAnswerFromToolResults(
        question,
        allToolResponses,
        'I found some co-op records, but Gemini did not return a finished answer. Please try a more specific question.',
      );
      const parsed = parseJsonResponse(responseText, { answer: responseText || fallbackAnswer, confidence: responseText ? 0.85 : 0.65 });
      return {
        answer: parsed.answer || responseText || fallbackAnswer,
        citations: [],
        language: normalizedLanguage,
        confidence: parsed.confidence || 0.85,
        intent: parsed.intent || intent.intent,
        suggestedAction: parsed.suggestedAction || (intent.suggestedAction ? JSON.parse(JSON.stringify(intent.suggestedAction)) : undefined),
      };
    });

    res.json(oracleResponse);
  } catch (e: any) {
    console.error(`[Oracle Demo Query Failure]: ${e.message}`, e);
    res.status(500).json({ error: `Gemini Oracle demo query failed: ${e.message}` });
  }
});

app.post('/api/oracle/query', requireAuth, async (req, res) => {
  const startedAt = Date.now();
  const { question, language, pageContext } = req.body;
  if (!question || String(question).trim().length < 2) return res.status(400).json({ error: 'Question is required.' });
  const normalizedLanguage = normalizeOracleLanguage(language);
  const intent = detectOracleIntent(question);
  const p = getPrisma();
  const user = (req as any).user || (req as any).session?.user;
  let coopId = '';

  try {
    coopId = await getCoopId(req, p);

    // Tool Context for checking permissions and scoping queries
    const toolContext: ToolContext = {
      prisma: p,
      cooperativeId: coopId,
      userId: user?.tenantId || 'unknown',
      userEmail: user?.email || '',
      role: user?.role || 'MEMBER',
      isAdmin: !!user?.isAdmin
    };

    const genAI = getAI();
    const primaryModel = user?.geminiModel || DEFAULT_GEMINI_MODEL;
    
    const oracleResponse = await withAiFallback(async (modelName) => {
      // Initialize model with tools
      const model = genAI.getGenerativeModel({
        model: modelName,
        tools: [{ functionDeclarations: oracleToolDeclarations as any }]
      });

      const chat = model.startChat();
      
      const prompt = `You are the Co-op Oracle for a BC housing co-op. Answer in ${normalizedLanguage}. 
You have access to tools that query the live database. Always use them to verify facts before answering.
If a member asks about a specific committee, unit, person, or record, search for it using the tools.
NEVER say something doesn't exist unless you have searched and found no matching records.

Database Overview:
- Unit: number, type, floor, status
- MaintenanceRequest: title, status, priority, category, unit (with number/floor)
- Tenant: firstName, lastName, email, role, unit
- Committee: name, chairName, description, memberNames
- CoopEvent, Announcement, Building

Database coverage:
- Use 'get_database_schema' to see the complete model map.
- You can retrieve co-op profile, buildings, units, tenants, maintenance, scheduled maintenance, announcements, documents, events, committees, and meeting minutes.
- 'open' maintenance requests = status 'Pending' or 'In Progress'.

Reasoning & Strategy:
- Use tools before answering factual questions about co-op records, policies, members, units, or maintenance.
- For broad factual searches, use 'search_coop_database'. For policy text, use 'search_coop_knowledge'.
- Chain tools when needed (e.g. committee -> chair -> tenant).
- Prefer specific filtered calls (e.g. filter by 'floor' in 'get_maintenance_requests') to reduce latency.
- If a tool returns errors but also usable data, answer from the data and don't mention the error.

Answer style:
- Use plain, resident-friendly language. Be concise (2-4 sentences).
- Use bullets only for lists. Avoid legal jargon.
- If urgent (leaks, safety), provide immediate next steps and advise checking with the board/emergency services.
- If citing a document, providing the ID or Title is sufficient; the system will show a citation button.

Role: ${user?.role || 'MEMBER'} (isAdmin: ${!!user?.isAdmin}).
Page context: ${pageContext || 'none'}.

Return JSON:
{
  "answer": "...",
  "confidence": 0.95,
  "intent": "maintenance" | "governance" | "policy" | "general",
  "suggestedAction": {
    "type": "start-maintenance-request" | "view-event" | "contact-board",
    "label": "Button Label",
    "href": "/target-page"
  } (optional)
}

Member Question: ${question}`;

      let result = await withTimeout(chat.sendMessage(prompt), AI_INITIAL_TIMEOUT_MS, 'Initial sendMessage');
      let response = result.response;
      
      // Loop to handle tool calls - optimized for parallel execution
      let callCount = 0;
      const MAX_CALLS = 2; // Strict limit for speed
      const allToolResponses: any[] = [];

      while (response.functionCalls()?.length && callCount < MAX_CALLS) {
        callCount++;
        const toolCalls = response.functionCalls() || [];
        
        // Execute all tool calls in this turn in parallel
        const toolResponses = await Promise.all(toolCalls.map(async (call) => {
          const toolName = call.name as keyof typeof oracleTools;
          const toolHandler = oracleTools[toolName];
          
          if (toolHandler) {
            console.log(`[Oracle] Executing tool (Parallel): ${toolName}`, call.args);
            try {
              const toolResult = await (toolHandler as any)(toolContext, call.args || {});
              return {
                functionResponse: {
                  name: toolName,
                  response: { result: toolResult }
                }
              };
            } catch (err: any) {
              console.error(`[Oracle] Tool execution error (${toolName}):`, err);
              return {
                functionResponse: {
                  name: toolName,
                  response: { error: err.message, toolName }
                }
              };
            }
          } else {
            console.warn(`[Oracle] Unknown tool called: ${toolName}`);
            return {
              functionResponse: {
                name: toolName,
                response: { error: "Tool not found" }
              }
            };
          }
        }));

        if (toolResponses.length > 0) {
          allToolResponses.push(...toolResponses);
          result = await withTimeout(chat.sendMessage(toolResponses), AI_TOOL_TIMEOUT_MS, `ToolResponse turn ${callCount}`);
          response = result.response;
        } else {
          break;
        }
      }

      // Safety check for empty text (e.g. if loop hit limit and model didn't provide final text)
      const responseText = response.text();
      const citations = extractCitationsFromToolResults(allToolResponses);

      if (!responseText) {
        const fallbackAnswer = createOracleAnswerFromToolResults(
          question,
          allToolResponses,
          'I gathered some data but was unable to formulate a complete answer in time. Please try a more specific question.',
        );
        return {
          answer: fallbackAnswer,
          citations,
          confidence: 0.5,
          intent: "general"
        };
      }

      const parsed = parseJsonResponse(responseText, { answer: responseText, confidence: 0.9 });
      return {
        answer: parsed.answer || responseText,
        citations, 
        language: normalizedLanguage,
        confidence: parsed.confidence || 0.9,
        intent: parsed.intent || intent.intent,
        suggestedAction: parsed.suggestedAction || (intent.suggestedAction ? JSON.parse(JSON.stringify(intent.suggestedAction)) : undefined),
      };
    }, primaryModel);

    // Log the query
    await p.policyAssistantQuery.create({
      data: {
        cooperativeId: coopId,
        userId: user?.email || 'unknown',
        question,
        retrievedChunks: [], // We used direct DB tools
        answer: oracleResponse.answer,
        citations: [],
        language: normalizedLanguage,
        intent: intent.intent,
        suggestedAction: intent.suggestedAction ? JSON.parse(JSON.stringify(intent.suggestedAction)) : undefined,
        latencyMs: Date.now() - startedAt,
      },
    });

    res.json(oracleResponse);
  } catch (e: any) {
    console.error(`[Oracle Query Failure]: ${e.message}`, e);
    if (coopId) {
      await p.policyAssistantQuery.create({
        data: {
          cooperativeId: coopId,
          userId: user?.email || 'unknown',
          question,
          retrievedChunks: [],
          answer: `Error occurred during processing: ${e.message}`,
          citations: [],
          language: normalizedLanguage,
          intent: intent.intent,
          suggestedAction: intent.suggestedAction ? JSON.parse(JSON.stringify(intent.suggestedAction)) : undefined,
          latencyMs: Date.now() - startedAt,
        },
      }).catch(() => undefined);
    }
    res.status(500).json({ error: `Gemini Oracle query failed: ${e.message}` });
  }
});

const getMeetingTypeGuidance = (meetingType?: string) => {
  switch (meetingType) {
    case 'quick':
      return 'Meeting type: Quick Meeting. Use professionalSummary as a concise overview of the discussion. Put only clear decisions or resolutions in decisions, and keep action items separate. Avoid board-report style narrative.';
    case 'agm':
      return 'Meeting type: Annual General Meeting. Organize output around AGM business such as reports, nominations/elections, motions, decisions, and statutory follow-up. Do not invent election results or auditor details.';
    case 'special':
      return 'Meeting type: Special Meeting. Focus on the stated special business, any motion or resolution, decision status, and required follow-up. Avoid unrelated regular meeting sections.';
    case 'regular':
    default:
      return 'Meeting type: Regular Board Meeting. Organize output for board minutes, including board/committee report narrative, motions, decisions, follow-up, and action items.';
  }
};

const buildMeetingAnalysisPrompt = (rawNotes: string, meetingType?: string) => `You are an experienced secretary for a BC housing co-operative board or committee.

${getMeetingTypeGuidance(meetingType)}

Transform rough, incomplete meeting notes into polished meeting minutes. Do not merely restate or lightly paraphrase the notes. Convert terse bullets into clear, professional minutes language while preserving only the facts that are actually present. Do not invent votes, approvals, names, dollar amounts, deadlines, or legal conclusions. If something is implied but uncertain, flag it in confidenceNotes.

Tone and structure:
- Neutral, concise, board-ready minutes language.
- Use complete sentences and coherent paragraphs.
- Summarize discussion by topic, not by transcript order when possible.
- Separate discussion, decisions, motions, action items, and unresolved follow-up.
- For each topic, produce final minutes text. Avoid meta labels such as "context", "discussion", or "implications" inside recommendedMinuteText.

Return valid JSON only with this shape:
{
  "professionalSummary": "1-3 concise professional paragraphs suitable for meeting minutes.",
  "topicBriefings": [
    {
      "topic": "Short topic heading",
      "context": "What prompted or framed the topic.",
      "discussionSummary": "A polished discussion summary expanding terse notes into board-ready language.",
      "implications": "Operational, governance, resident, budget, timing, or accountability implications if present.",
      "recommendedMinuteText": "A concise final paragraph suitable to paste directly into meeting minutes, with no labels or commentary."
    }
  ],
  "decisions": ["Clear decisions or resolutions. Use professional wording. Do not list undecided discussion here."],
  "motionsMentioned": ["Motion or resolution text rewritten clearly where the notes support it."],
  "actionItems": [
    {
      "id": "short-stable-id",
      "description": "Specific action to be completed.",
      "ownerName": "Named owner if present, otherwise omit",
      "committee": "Committee if present, otherwise omit",
      "dueDate": "YYYY-MM-DD if explicit, otherwise omit",
      "priority": "Low | Medium | High",
      "sourceSnippet": "Short source phrase from the notes"
    }
  ],
  "risksOrFollowUps": ["Open questions, dependencies, missing approvals, or items to carry forward."],
  "confidenceNotes": ["Any assumptions, ambiguity, or missing source details that an admin should review."]
}

Rough notes:
${rawNotes}`;

const normalizeMeetingAnalysis = (parsed: any) => {
  const asStringArray = (value: any) => Array.isArray(value) ? value.filter(Boolean).map(item => String(item)) : [];
  const topicBriefings = Array.isArray(parsed.topicBriefings)
    ? parsed.topicBriefings.map((item: any) => ({
      topic: String(item?.topic || 'Meeting Topic'),
      context: String(item?.context || ''),
      discussionSummary: String(item?.discussionSummary || ''),
      implications: String(item?.implications || ''),
      recommendedMinuteText: String(item?.recommendedMinuteText || ''),
    }))
    : [];
  const actionItems = Array.isArray(parsed.actionItems)
    ? parsed.actionItems.map((item: any, index: number) => ({
      id: String(item?.id || `ai-action-${index + 1}`),
      description: String(item?.description || '').trim(),
      ownerName: item?.ownerName ? String(item.ownerName) : undefined,
      committee: item?.committee ? String(item.committee) : undefined,
      dueDate: item?.dueDate ? String(item.dueDate) : undefined,
      priority: ['Low', 'Medium', 'High'].includes(String(item?.priority)) ? String(item.priority) : 'Medium',
      sourceSnippet: item?.sourceSnippet ? String(item.sourceSnippet) : undefined,
    })).filter((item: any) => item.description)
    : [];

  return {
    professionalSummary: String(parsed.professionalSummary || 'Meeting summary could not be generated.'),
    topicBriefings,
    decisions: asStringArray(parsed.decisions),
    motionsMentioned: asStringArray(parsed.motionsMentioned),
    actionItems,
    risksOrFollowUps: asStringArray(parsed.risksOrFollowUps),
    confidenceNotes: asStringArray(parsed.confidenceNotes),
  };
};

const generateMeetingAnalysis = async (rawNotes: string, meetingType?: string, modelName = DEFAULT_GEMINI_MODEL) => {
  const model = getAI().getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(buildMeetingAnalysisPrompt(rawNotes, meetingType));
  const response = await result.response;
  return normalizeMeetingAnalysis(parseJsonResponse(response.text(), {}));
};

app.post('/api/ai/meeting-analysis-demo', async (req, res) => {
  const { rawNotes, meetingId, meetingType } = req.body;
  if (!rawNotes || String(rawNotes).trim().length < 20) return res.status(400).json({ error: 'Meeting notes must be at least 20 characters.' });
  try {
    const analysis = await generateMeetingAnalysis(rawNotes, meetingType);
    res.json({
      id: `demo-meeting-analysis-${Date.now()}`,
      meetingId: meetingId || null,
      rawNotes,
      ...analysis,
      createdBy: 'demo-gemini',
      createdAt: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: `Gemini meeting analysis failed: ${e.message}` });
  }
});

app.post('/api/ai/meeting-analysis', requireAuth, requireAdmin, async (req, res) => {
  const { rawNotes, meetingId, meetingType } = req.body;
  if (!rawNotes || String(rawNotes).trim().length < 20) return res.status(400).json({ error: 'Meeting notes must be at least 20 characters.' });
  const p = getPrisma();
  try {
    const user = (req as any).user || (req as any).session?.user;
    const coopId = await getCoopId(req, p);
    const generated = await generateMeetingAnalysis(rawNotes, meetingType, user?.geminiModel || DEFAULT_GEMINI_MODEL);
    const analysis = await p.meetingAnalysis.create({
      data: {
        cooperativeId: coopId,
        meetingId: meetingId || null,
        rawNotes,
        professionalSummary: generated.professionalSummary,
        decisions: generated.decisions,
        motionsMentioned: generated.motionsMentioned,
        actionItems: generated.actionItems,
        risksOrFollowUps: generated.risksOrFollowUps,
        createdBy: user?.email || 'unknown',
      },
    });
    const notifications = mapMeetingActionsToNotifications({ cooperativeId: coopId, meetingId, actions: generated.actionItems });
    for (const notification of notifications) {
      await createSystemNotification(p, {
        cooperativeId: coopId,
        audience: notification.audience,
        recipientUserEmail: notification.recipientUserEmail,
        type: notification.type,
        severity: notification.severity,
        title: notification.title,
        body: notification.body,
        entityType: notification.entityType,
        entityId: notification.entityId,
        actionUrl: notification.actionUrl,
      }).catch(error => console.error('Failed to notify action item:', error));
    }
    res.json({ ...analysis, topicBriefings: generated.topicBriefings, confidenceNotes: generated.confidenceNotes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/summarize', requireAuth, async (req, res) => {
  try {
    const genAI = getAI();
    const user = (req as any).user || (req as any).session?.user;
    const resolvedModel = user?.geminiModel || DEFAULT_GEMINI_MODEL;
    const model = genAI.getGenerativeModel({ model: resolvedModel });
    const { content } = req.body;

    const result = await model.generateContent(`Analyze the following document content from a BC Housing Co-operative. Provide a short summary (max 2 sentences) and suggest 3-5 relevant semantic tags for categorization (e.g., "pets", "parking", "agm").\n\nContent: ${content.substring(0, 5000)}`);
    const response = await result.response;
    res.json(JSON.parse(response.text() || '{"summary": "", "tags": []}'));
  } catch (e: any) {
    res.status(500).json({ summary: '', tags: [], error: e.message });
  }
});

const FALLBACK_GEMINI_TTS_MODEL = 'gemini-2.5-pro-preview-tts';

app.post('/api/ai/demo-tour-tts', async (req, res) => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Gemini API key is not configured.' });

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (text.length < 8) return res.status(400).json({ error: 'Narration text is required.' });
    if (text.length > 1600) return res.status(400).json({ error: 'Narration text is too long.' });

    // 1. Check persistent cache (Vercel Blob)
    const textHash = crypto.createHash('sha256').update(text).digest('hex');
    const cachePath = `tts-cache/${textHash}.wav`;
    const token = getBlobToken();

    if (token && token.length > 10) {
      try {
        const { blobs } = await list({ prefix: cachePath, token, limit: 1 });
        const existing = blobs.find(b => b.pathname === cachePath);
        if (existing) {
          console.log(`[TTS Cache] Hit: ${cachePath}`);
          return res.redirect(existing.url);
        }
      } catch (cacheErr) {
        console.warn('[TTS Cache] Error checking cache:', cacheErr);
      }
    }

    // 2. Cache miss: Generate narration
    const generateSpeech = async (modelName: string) => {
      console.log(`[TTS] Requesting generation from ${modelName}...`);
      return axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          contents: [{
            parts: [{
              text: `Read this guided tour narration in a warm, clear, welcoming voice at a calm pace:\n\n${text}`,
            }],
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
          model: modelName,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          timeout: 25000,
        },
      );
    };

    let response;
    try {
      response = await generateSpeech(DEFAULT_GEMINI_TTS_MODEL);
    } catch (e: any) {
      const status = e.response?.status;
      const isRateLimit = status === 429;
      const isModelNotFound = status === 404 || status === 400;
      
      if (isRateLimit || isModelNotFound) {
        console.log(`TTS model ${DEFAULT_GEMINI_TTS_MODEL} failed (status ${status}), trying fallback ${FALLBACK_GEMINI_TTS_MODEL}...`);
        try {
          response = await generateSpeech(FALLBACK_GEMINI_TTS_MODEL);
        } catch (e2: any) {
          console.error(`TTS fallback model ${FALLBACK_GEMINI_TTS_MODEL} also failed:`, e2.response?.data || e2.message);
          throw e2;
        }
      } else {
        console.error(`TTS primary model ${DEFAULT_GEMINI_TTS_MODEL} failed with unhandled status ${status}:`, e.response?.data || e.message);
        throw e;
      }
    }

    const inlineData = response.data?.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData || part.inline_data);
    const audioBase64 = inlineData?.inlineData?.data || inlineData?.inline_data?.data;
    if (!audioBase64) {
      console.error('Gemini response missing audio data:', JSON.stringify(response.data, null, 2));
      throw new Error('Gemini did not return audio data.');
    }

    const wav = pcm16ToWavBuffer(Buffer.from(audioBase64, 'base64'), 24000, 1);

    // 3. Save to persistent cache asynchronously
    if (token && token.length > 10) {
      put(cachePath, wav, {
        access: 'public',
        contentType: 'audio/wav',
        token,
        addRandomSuffix: false,
      }).then(blob => {
        console.log(`[TTS Cache] Saved: ${blob.url}`);
      }).catch(err => {
        console.error('[TTS Cache] Failed to save:', err);
      });
    }

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(wav);
  } catch (e: any) {
    const message = e.response?.data?.error?.message || e.message || 'Unknown Gemini TTS error';
    res.status(500).json({ error: `Gemini tour narration failed: ${message}` });
  }
});

app.post('/api/ai/summarize-demo', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || String(content).trim().length < 20) {
      return res.status(400).json({ error: 'Document content is required.' });
    }
    const model = getAI().getGenerativeModel({ model: DEFAULT_GEMINI_MODEL });
    const result = await model.generateContent(`Analyze the following document content from a BC Housing Co-operative. Provide a short summary (max 2 sentences) and suggest 3-5 relevant semantic tags for categorization (e.g., "pets", "parking", "agm"). Return JSON only with summary and tags.\n\nContent: ${String(content).substring(0, 5000)}`);
    const response = await result.response;
    res.json(parseJsonResponse(response.text(), { summary: '', tags: [] }));
  } catch (e: any) {
    res.status(500).json({ error: `Gemini document summary failed: ${e.message}` });
  }
});


app.get('/api/migrate', async (req, res) => {
  try {
    const p = getPrisma();

    console.log('Running robust SQL migrations...');
    
    // 1. Create Cooperative table
    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Cooperative" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "address" TEXT,
        "city" TEXT,
        "province" TEXT NOT NULL DEFAULT 'BC',
        "adminEmail" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Cooperative_pkey" PRIMARY KEY ("id")
      );
    `);
    await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Cooperative_slug_key" ON "Cooperative"("slug");`);

    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Building" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "code" TEXT,
        "address" TEXT,
        "sortOrder" INTEGER NOT NULL DEFAULT 1,
        "cooperativeId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
      );
    `);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Building_cooperativeId_idx" ON "Building"("cooperativeId");`);
    await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Building_cooperativeId_name_key" ON "Building"("cooperativeId", "name");`);

    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Notification" (
        "id" TEXT NOT NULL,
        "cooperativeId" TEXT NOT NULL,
        "audience" TEXT NOT NULL,
        "recipientUserEmail" TEXT,
        "type" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'info',
        "title" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "entityType" TEXT,
        "entityId" TEXT,
        "actionUrl" TEXT,
        "readAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
      );
    `);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_cooperativeId_idx" ON "Notification"("cooperativeId");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_recipientUserEmail_idx" ON "Notification"("recipientUserEmail");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_readAt_idx" ON "Notification"("readAt");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_type_idx" ON "Notification"("type");`);

    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MeetingAnalysis" (
        "id" TEXT NOT NULL,
        "meetingId" TEXT,
        "cooperativeId" TEXT NOT NULL,
        "rawNotes" TEXT NOT NULL,
        "professionalSummary" TEXT NOT NULL,
        "decisions" JSONB NOT NULL,
        "motionsMentioned" JSONB NOT NULL,
        "actionItems" JSONB NOT NULL,
        "risksOrFollowUps" JSONB NOT NULL,
        "createdBy" TEXT NOT NULL,
        "approvedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MeetingAnalysis_pkey" PRIMARY KEY ("id")
      );
    `);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingAnalysis_cooperativeId_idx" ON "MeetingAnalysis"("cooperativeId");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingAnalysis_meetingId_idx" ON "MeetingAnalysis"("meetingId");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MeetingAnalysis_createdAt_idx" ON "MeetingAnalysis"("createdAt");`);

    await p.$executeRawUnsafe(`ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "buildingId" TEXT;`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Unit_buildingId_idx" ON "Unit"("buildingId");`);
    await p.$executeRawUnsafe(`ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "attachments" JSONB;`);
    await p.$executeRawUnsafe(`ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "aiTriage" JSONB;`);
    await p.$executeRawUnsafe(`ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "visualDescription" TEXT;`);
    await p.$executeRawUnsafe(`ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "residentTip" TEXT;`);
    await p.$executeRawUnsafe(`ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "triageReviewedBy" TEXT;`);
    await p.$executeRawUnsafe(`ALTER TABLE "MaintenanceRequest" ADD COLUMN IF NOT EXISTS "triageReviewedAt" TIMESTAMP(3);`);
    await p.$executeRawUnsafe(`ALTER TABLE "PolicyAssistantQuery" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'English';`);
    await p.$executeRawUnsafe(`ALTER TABLE "PolicyAssistantQuery" ADD COLUMN IF NOT EXISTS "intent" TEXT NOT NULL DEFAULT 'policy';`);
    await p.$executeRawUnsafe(`ALTER TABLE "PolicyAssistantQuery" ADD COLUMN IF NOT EXISTS "suggestedAction" JSONB;`);
    await p.$executeRawUnsafe(`ALTER TABLE "PolicyAssistantQuery" ADD COLUMN IF NOT EXISTS "feedback" TEXT;`);

    // 2. Add cooperativeId to all models
    const tables = [
      "Unit", "Tenant", "TenantHistory", "MaintenanceRequest", 
      "Announcement", "Document", "CoopEvent", "Committee"
    ];
    for (const table of tables) {
      await p.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "cooperativeId" TEXT;`);
    }

    // 2b. Create MeetingMinutes table if not exists
    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MeetingMinutes" (
        "id" TEXT NOT NULL,
        "meetingId" TEXT NOT NULL,
        "meetingType" TEXT NOT NULL,
        "data" JSONB NOT NULL,
        "attendees" JSONB NOT NULL,
        "motions" JSONB NOT NULL,
        "cooperativeId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdBy" TEXT NOT NULL,
        "approvedBy" TEXT,
        "approvalDate" TIMESTAMP(3),
        CONSTRAINT "MeetingMinutes_pkey" PRIMARY KEY ("id")
      );
    `);
    await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MeetingMinutes_meetingId_key" ON "MeetingMinutes"("meetingId");`);

    // 3. Add specific missing columns
    await p.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'MEMBER';`);
    try {
      await p.$executeRawUnsafe(`CREATE TYPE "DocumentVisibility" AS ENUM ('PUBLIC', 'MEMBERS', 'COMMITTEE', 'BOARD', 'ADMIN');`);
    } catch (e) { /* ignore if exists */ }
    try {
      await p.$executeRawUnsafe(`CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'SUPERSEDED');`);
    } catch (e) { /* ignore if exists */ }
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "committee" TEXT DEFAULT '';`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "content" TEXT;`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE';`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "visibility" "DocumentVisibility" NOT NULL DEFAULT 'MEMBERS';`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "committeeAccess" TEXT;`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP(3);`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "reviewDate" TIMESTAMP(3);`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "supersedes" TEXT;`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "supersededBy" TEXT;`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "relatedDocs" TEXT[] DEFAULT ARRAY[]::TEXT[];`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "fullTextSearch" TEXT;`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "currentVersionId" TEXT;`);
    await p.$executeRawUnsafe(`ALTER TABLE "Document" DROP COLUMN IF EXISTS "isPrivate";`);

    // 4. Handle Enums and ScheduledMaintenance
    // Check if types exist before creating
    try {
      await p.$executeRawUnsafe(`CREATE TYPE "MaintenanceFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');`);
    } catch (e) { /* ignore if exists */ }
    
    try {
      await p.$executeRawUnsafe(`CREATE TYPE "MaintenanceCategory" AS ENUM ('PLUMBING', 'ELECTRICAL', 'HVAC', 'SAFETY', 'GENERAL', 'OTHER');`);
    } catch (e) { /* ignore if exists */ }

    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ScheduledMaintenance" (
        "id" TEXT NOT NULL,
        "unitId" TEXT NOT NULL,
        "task" TEXT NOT NULL,
        "description" TEXT,
        "frequency" "MaintenanceFrequency" NOT NULL,
        "dueDate" TIMESTAMP(3) NOT NULL,
        "lastCompleted" TIMESTAMP(3),
        "assignedTo" TEXT NOT NULL,
        "isCompleted" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "category" "MaintenanceCategory" NOT NULL,
        "cooperativeId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "ScheduledMaintenance_pkey" PRIMARY KEY ("id")
      );
    `);

    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DocumentVersion" (
        "id" TEXT NOT NULL,
        "documentId" TEXT NOT NULL,
        "cooperativeId" TEXT NOT NULL,
        "version" INTEGER NOT NULL,
        "source" TEXT NOT NULL,
        "storageUrl" TEXT NOT NULL,
        "storageKey" TEXT,
        "fileType" TEXT NOT NULL,
        "mimeType" TEXT,
        "sizeBytes" INTEGER,
        "checksum" TEXT,
        "ingestionStatus" TEXT NOT NULL DEFAULT 'pending',
        "ingestionError" TEXT,
        "ingestionStartedAt" TIMESTAMP(3),
        "ingestionCompletedAt" TIMESTAMP(3),
        "ingestionDurationMs" INTEGER,
        "extractionMethod" TEXT,
        "extractionConfidence" DOUBLE PRECISION,
        "chunkCount" INTEGER,
        "tokenCount" INTEGER,
        "extractedText" TEXT,
        "summary" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
      );
    `);
    await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentVersion_cooperativeId_idx" ON "DocumentVersion"("cooperativeId");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentVersion_ingestionStatus_idx" ON "DocumentVersion"("ingestionStatus");`);

    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DocumentIngestionJob" (
        "id" TEXT NOT NULL,
        "documentId" TEXT NOT NULL,
        "documentVersionId" TEXT NOT NULL,
        "cooperativeId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'queued',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "maxAttempts" INTEGER NOT NULL DEFAULT 3,
        "nextRetryAt" TIMESTAMP(3),
        "error" TEXT,
        "errorStack" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DocumentIngestionJob_pkey" PRIMARY KEY ("id")
      );
    `);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentIngestionJob_cooperativeId_idx" ON "DocumentIngestionJob"("cooperativeId");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentIngestionJob_status_nextRetryAt_idx" ON "DocumentIngestionJob"("status", "nextRetryAt");`);

    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DashboardPreference" (
        "id" TEXT NOT NULL,
        "cooperativeId" TEXT NOT NULL,
        "userEmail" TEXT NOT NULL,
        "layout" JSONB NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DashboardPreference_pkey" PRIMARY KEY ("id")
      );
    `);
    await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "DashboardPreference_cooperativeId_userEmail_key" ON "DashboardPreference"("cooperativeId", "userEmail");`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DashboardPreference_cooperativeId_idx" ON "DashboardPreference"("cooperativeId");`);

    // 5. Foreign Key Constraints (Ensure they exist or add them)
    // Note: We skip complex FK management here to avoid errors if they already exist, 
    // focusing on structure first.

    // Check if seeding is needed
    const unitCount = await p.unit.count();
    
    if (unitCount === 0) {
      console.log('Database empty, triggering auto-seed info...');
      return res.json({
        success: true,
        message: "Database schema updated successfully. Please now visit /api/seed to restore your data."
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

        // Create initial history record
        await p.tenantHistory.create({
          data: {
            tenantId: tenant.id,
            unitId: unitMap[t.unit],
            cooperativeId: coopId,
            startDate: new Date(t.startDate),
            moveReason: 'Initial Seed Residency'
          }
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


   app.use('/api/drive', driveRoutes);

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

// Export middleware and helpers for use in other route files
export { requireAuth, getCoopId };

export default app;
