import { NextResponse, NextRequest } from 'next/server';

function getBaseUrl(request: NextRequest) {
  const host = request.headers.get('host');
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }
  
  return `${protocol}://${host}`;
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);
  const redirectUri = `${baseUrl}/auth/callback`;

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID is not configured' }, { status: 500 });
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
  return NextResponse.json({ url: authUrl });
}
