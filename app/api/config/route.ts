import { NextResponse } from 'next/server';
import { getSession } from '../../../utils/session';

export async function GET() {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleApiKey: process.env.PICKER_API_KEY,
  });
}
