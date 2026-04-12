import { NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';

export async function GET() {
  try {
    const units = await prisma.unit.findMany({
      include: {
        currentTenant: true,
        occupancyHistory: {
          include: { tenant: true },
          orderBy: { startDate: 'desc' }
        }
      }
    });
    return NextResponse.json(units);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
