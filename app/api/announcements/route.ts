import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';
import { announcementSchema } from '../../../utils/validation';
import { getSession } from '../../../utils/session';

export async function GET() {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const announcements = await prisma.announcement.findMany({
      where: { cooperativeId: session.cooperativeId },
      orderBy: { date: 'desc' }
    });
    return NextResponse.json(announcements);
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
    const validatedData = announcementSchema.parse(body);
    const announcement = await prisma.announcement.create({
      data: {
        title: validatedData.title,
        content: validatedData.content,
        type: validatedData.type,
        priority: validatedData.priority,
        author: validatedData.author || session.email,
        date: validatedData.date,
        cooperativeId: session.cooperativeId,
      }
    });
    return NextResponse.json(announcement);
  } catch (error: any) {
    console.error('Failed to create announcement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}