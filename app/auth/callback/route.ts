import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../../../utils/prisma';
import { getSession } from '../../../utils/session';

function getBaseUrl(request: NextRequest) {
  const host = request.headers.get('host');
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }
  
  return `${protocol}://${host}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) return new NextResponse('No code provided', { status: 400 });

  try {
    const baseUrl = getBaseUrl(request);
    const redirectUri = `${baseUrl}/auth/callback`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      throw new Error(`Token request failed: ${errorData}`);
    }

    const { access_token } = await tokenResponse.json();
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.text();
      throw new Error(`User info request failed: ${errorData}`);
    }

    const userData = await userResponse.json();
    const email = userData.email.toLowerCase();

    // Find or create user in database
    let user = await prisma.tenant.findUnique({
      where: { email },
      include: { unit: true }
    });

    // Check both DB role and legacy list for now
    const isAdmin = user?.role === 'ADMIN' || ['joewansbrough@gmail.com', 'wwansbro@gmail.com', 'joewcoupons@gmail.com', 'samisaeed123@gmail.com'].includes(email);

    // Dynamically resolve the best available Gemini model once at login
    let resolvedModel = 'gemini-2.0-flash-lite'; // Updated fallback
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

      if (ranked[0]?.name) {
        resolvedModel = ranked[0].name.replace('models/', '');
      }
    } catch (err) {
      console.warn('[ModelResolver] Model listing failed, using fallback:', err);
    }

    const session = await getSession();
    session.email = email;
    session.name = userData.name;
    session.picture = userData.picture;
    session.isAdmin = isAdmin;
    session.tenantId = user?.id || null;
    session.unitNumber = user?.unit?.number || null;
    session.role = user?.role || 'MEMBER';
    session.geminiModel = resolvedModel;
    await session.save();

    const html = `
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
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new NextResponse('Authentication failed', { status: 500 });
  }
}
