import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../utils/prisma';
import { getSession } from '../../../../utils/session';
import { z } from 'zod';

const documentUpdateSchema = z.object({
  title: z.string().min(1, { message: 'Document title is required.' }),
  category: z.string().min(1, { message: 'Category is required.' }),
  committee: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  content: z.string().optional().nullable(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const validatedData = documentUpdateSchema.parse(payload);
    const updated = await prisma.document.update({
      where: { id },
      data: {
        title: validatedData.title,
        category: validatedData.category,
        committee: validatedData.committee ?? null,
        tags: validatedData.tags,
        content: validatedData.content,
      },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Failed to update document:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Document id is required.' }, { status: 400 });
  }

  try {
    await prisma.document.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete document:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
