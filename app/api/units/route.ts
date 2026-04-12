import { NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';
import { getSession } from '../../../utils/session';
import type { Prisma } from '@prisma/client';

export async function GET() {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const include: Prisma.UnitInclude = {
      currentTenant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      },
    };
    if (session.isAdmin) {
      include.occupancyHistory = {
        include: {
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { startDate: 'desc' },
      };
    }

    const units = await prisma.unit.findMany({ include });
    return NextResponse.json(units);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
