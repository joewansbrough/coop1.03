import { NextResponse } from 'next/server';
import { getSession } from '../../../../utils/session';


export async function POST() {
  const isProduction = process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV;
  if (isProduction) {
    return NextResponse.json({ error: 'Bypass not allowed in production' }, { status: 403 });
  }

  const session = await getSession();
  session.email = 'guest@example.com';
  session.name = 'Guest User';
  session.picture = 'https://picsum.photos/seed/guest/200';
  session.isAdmin = false;
  session.isGuest = true;
  session.tenantId = null;
  session.unitNumber = 'GUEST-001';
  session.role = 'MEMBER';
  session.geminiModel = 'gemini-2.0-flash-lite';
  await session.save();

  return NextResponse.json({ success: true, user: session });
}
