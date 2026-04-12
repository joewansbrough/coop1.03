import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';
import { getSession } from '../../../utils/session';
import { transactionSchema } from '../../../utils/validation';

export async function GET() {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const where = session.isAdmin
    ? undefined
    : session.tenantId
      ? { tenantId: session.tenantId }
      : { tenantId: '' };

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      tenant: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return NextResponse.json(transactions);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = transactionSchema.parse(body);
    const tenantId = session.isAdmin ? (validated.tenantId ?? session.tenantId) : session.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context is required' }, { status: 400 });
    }

    const transaction = await prisma.transaction.create({
      data: {
        tenantId,
        amount: validated.amount,
        currency: validated.currency,
        type: validated.type,
        description: validated.description,
        direction: validated.direction ?? 'CREDIT',
        status: validated.status ?? 'PAID',
        metadata: validated.metadata,
        date: validated.date ? new Date(validated.date) : new Date(),
      },
      include: {
        tenant: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return NextResponse.json(transaction);
  } catch (error: any) {
    console.error('Transaction error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
