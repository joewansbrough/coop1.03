import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';
import { maintenanceSchema } from '../../../utils/validation';

export async function GET() {
  try {
    const requests = await prisma.maintenanceRequest.findMany({
      include: { unit: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = maintenanceSchema.parse(body);
    const maintenanceRequest = await prisma.maintenanceRequest.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        status: validatedData.status,
        priority: validatedData.priority,
        category: validatedData.category as any,
        unitId: validatedData.unitId as string,
      },
      include: { unit: true }
    });
    return NextResponse.json(maintenanceRequest);
  } catch (error: any) {
    console.error('Failed to create maintenance request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
