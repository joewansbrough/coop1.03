import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';
import { coopEventSchema } from '../../../utils/validation';
import { getSession } from '../../../utils/session';

export async function GET() {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const events = await prisma.coopEvent.findMany({
      orderBy: { date: 'asc' }
    });
    return NextResponse.json(events);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validatedData = coopEventSchema.parse(body);
    const event = await prisma.coopEvent.create({
      data: validatedData,
    });
    return NextResponse.json(event);
  } catch (error: any) {
    console.error('Failed to create event:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
