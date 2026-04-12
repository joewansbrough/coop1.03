import { NextResponse } from 'next/server';
import { getSession } from '../../../../utils/session';

export async function GET() {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: session });
}
