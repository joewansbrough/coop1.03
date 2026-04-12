import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';

export async function GET() {
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
  try {
    const body = await request.json();
    const event = await prisma.coopEvent.create({
      data: body
    });
    return NextResponse.json(event);
  } catch (error: any) {
    console.error('Failed to create event:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
