import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';
import { documentSchema } from '../../../utils/validation';
import { getSession } from '../../../utils/session';

export async function GET() {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const documents = await prisma.document.findMany({
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(documents);
  } catch (error: any) {
    console.error('Failed to load documents:', error);
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
    const validatedData = documentSchema.parse(body);
    const {
      title,
      category,
      committee,
      url,
      fileType,
      author,
      date,
      tags,
      content,
    } = validatedData;

    const document = await prisma.document.create({
      data: {
        title,
        category,
        committee: committee ?? null,
        url,
        fileType,
        author,
        date,
        tags: tags ?? [],
        content: content ?? null,
      },
    });
    return NextResponse.json(document);
  } catch (error: any) {
    console.error('Failed to save document:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
