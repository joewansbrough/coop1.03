import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';
import { announcementSchema } from '../../../utils/validation';

export async function GET() {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { date: 'desc' }
    });
    return NextResponse.json(announcements);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = announcementSchema.parse(body);
    const announcement = await prisma.announcement.create({
      data: {
        title: validatedData.title,
        content: validatedData.content,
        type: validatedData.type,
        priority: validatedData.priority,
        author: validatedData.author,
        date: validatedData.date,
      }
    });
    return NextResponse.json(announcement);
  } catch (error: any) {
    console.error('Failed to create announcement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
