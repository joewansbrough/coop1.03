import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../utils/prisma';
import { getSession } from '../../../../../utils/session';

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ');

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Committee id is required.' }, { status: 400 });
  }

  try {
    const { memberName } = await request.json();
    if (!memberName || typeof memberName !== 'string') {
      return NextResponse.json({ error: 'Member name is required.' }, { status: 400 });
    }
    const normalized = normalizeName(memberName);
    const [firstName, ...rest] = normalized.split(' ');
    const lastName = rest.join(' ');

    const tenant = await prisma.tenant.findFirst({
      where: {
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: lastName ? { equals: lastName, mode: 'insensitive' } : undefined,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    await prisma.committee.update({
      where: { id },
      data: {
        members: {
          connect: { id: tenant.id },
        },
      },
    });

    return NextResponse.json({
      success: true,
      member: { id: tenant.id, name: normalizeName(`${tenant.firstName} ${tenant.lastName}`) },
    });
  } catch (error: any) {
    console.error('Failed to add member to committee:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
