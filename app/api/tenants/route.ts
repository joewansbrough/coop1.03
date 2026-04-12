import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';
import { tenantSchema } from '../../../utils/validation';

export async function GET() {
  try {
    const tenants = await prisma.tenant.findMany({
      include: { unit: true }
    });
    return NextResponse.json(tenants);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = tenantSchema.parse(body);
    const tenant = await prisma.tenant.create({
      data: {
        ...validatedData,
        firstName: validatedData.firstName as string,
        lastName: validatedData.lastName as string,
        email: validatedData.email as string,
        phone: validatedData.phone ?? undefined,
        unitId: validatedData.unitId ?? undefined,
        startDate: validatedData.startDate,
        status: validatedData.status,
        role: validatedData.role,
      },
      include: { unit: true }
    });
    return NextResponse.json(tenant);
  } catch (error: any) {
    console.error('Failed to create tenant:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
