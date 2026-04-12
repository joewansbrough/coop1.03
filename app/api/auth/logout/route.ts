import { NextResponse } from 'next/server';
import { getSession } from '../../../../utils/session';

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ success: true });
}
