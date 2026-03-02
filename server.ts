
import express from 'express';
import { createServer as createViteServer } from 'vite';
import cookieSession from 'cookie-session';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// Mock Data (In a real app, this would be in a database)
const ADMIN_EMAILS = ['joewcoupons@gmail.com'];
const TENANT_EMAILS = ['tenant1@example.com', 'tenant2@example.com'];

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
  app.use(express.json());
  app.use((req, res, next) => {
    cookieSession({
      name: 'session',
      keys: [process.env.SESSION_SECRET || 'default_secret'],
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: req.secure,
      sameSite: 'none',
      httpOnly: true,
      signed: true,
      overwrite: true,
      proxy: true,
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

  // Auth Routes
  app.get('/api/auth/url', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/auth/callback`;
    console.log('Initiating OAuth with redirectUri:', redirectUri);
    
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
      console.log('Exchanging code for token with redirectUri:', redirectUri);
      
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
      const email = userData.email;
      console.log('Google user email:', email);

      // Check permissions
      const isAdmin = ADMIN_EMAILS.includes(email);
      const isTenant = TENANT_EMAILS.includes(email) || isAdmin;

      if (!isTenant) {
        return res.send(`
          <html>
            <body>
              <script>
                alert("Access denied. Your email ${email} is not registered in CoopConnect BC.");
                window.close();
              </script>
            </body>
          </html>
        `);
      }

      // Set session - Keep it small to avoid cookie size limits
      (req as any).session.user = {
        email: email.toLowerCase(),
        name: userData.name,
        picture: userData.picture,
        isAdmin,
      };

      console.log(`Session set for ${email}. Cookie size approx: ${JSON.stringify((req as any).session.user).length} bytes`);

      res.send(`
        <html>
          <body>
            <script>
              console.log("Sending OAUTH_AUTH_SUCCESS message to opener");
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                setTimeout(() => window.close(), 100);
              } else {
                console.log("No opener found, redirecting to /");
                window.location.href = '/';
              }
            </script>
            <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h2>Authentication successful</h2>
              <p>This window should close automatically. If not, you can close it manually.</p>
              <button onclick="window.close()">Close Window</button>
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
    const user = (req as any).session?.user || null;
    const hasCookie = !!req.headers.cookie;
    console.log('Fetching /api/auth/me. Has cookies:', hasCookie, 'User found:', !!user);
    if (hasCookie && !user) {
      console.log('Cookies present but session user is missing. Raw cookies:', req.headers.cookie);
    }
    res.json({ user });
  });

  app.post('/api/auth/logout', (req, res) => {
    (req as any).session = null;
    res.json({ success: true });
  });

  app.get('/api/debug/config', (req, res) => {
    const host = req.get('x-forwarded-host') || req.get('host') || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
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
      isLocal,
      hasSession: !!(req as any).session,
      hasUser: !!(req as any).session?.user,
      headers: req.headers,
    });
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

startServer();
