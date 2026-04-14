import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';
import { maintenanceSchema } from '../../../utils/validation';
import { getSession } from '../../../utils/session';

export async function GET() {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const requests = await prisma.maintenanceRequest.findMany({
      include: {
        unit: {
          select: { id: true, number: true, floor: true, type: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' }
    });
    const normalized = requests.map(r => ({
      ...r,
      urgency: 'Medium',
    }));
    return NextResponse.json(normalized);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const validatedData = maintenanceSchema.parse(body);
    const storedCategory = validatedData.category.join(', ');
    const maintenanceRequest = await prisma.maintenanceRequest.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        status: validatedData.status,
        priority: validatedData.priority,
        category: storedCategory,
        tenantId: session.tenantId ?? null,
        requestedBy: validatedData.requestedBy ?? session.email,
        notes: validatedData.notes?.length ? validatedData.notes : undefined,
        expenses: validatedData.expenses?.length ? validatedData.expenses : undefined,
        unitId: validatedData.unitId as string,
	cooperativeId: session.cooperativeId,
      },
      include: { unit: true }
    });
    return NextResponse.json({
      ...maintenanceRequest,
      category: validatedData.category,
      urgency: validatedData.urgency ?? 'Medium',
    });
  } catch (error: any) {
    console.error('Failed to create maintenance request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
