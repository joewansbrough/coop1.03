import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../utils/prisma';
import { getSession } from '../../../../utils/session';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing request id' }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const { status } = payload;
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
      },
      include: {
        unit: {
          select: { id: true, number: true, floor: true, type: true, status: true },
        },
      },
    });

    return NextResponse.json({
      ...updated,
      urgency: 'Medium',
    });
  } catch (error: any) {
    console.error('Failed to update maintenance request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
