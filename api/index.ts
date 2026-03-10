import express from 'express';
import cookieSession from 'cookie-session';
import axios from 'axios';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

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

app.use(express.json());
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
    proxy: true,
  })(req, res, next);
});

// Mock Data
const ADMIN_EMAILS = ['joewcoupons@gmail.com'];
const TENANT_EMAILS = ['tenant1@example.com', 'tenant2@example.com'];

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

// --- Database API Routes ---

app.get('/api/units', async (req, res) => {
  const units = await prisma.unit.findMany({
    include: { currentTenant: true }
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

app.get('/api/maintenance', async (req, res) => {
  const requests = await prisma.maintenanceRequest.findMany({
    include: { unit: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(requests);
});

app.get('/api/announcements', async (req, res) => {
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(announcements);
});

app.get('/api/documents', async (req, res) => {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(documents);
});

app.get('/api/committees', async (req, res) => {
  const committees = await prisma.committee.findMany({
    include: { members: true }
  });
  res.json(committees);
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
