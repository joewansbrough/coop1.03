import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';
import { committeeSchema } from '../../../utils/validation';
import { getSession } from '../../../utils/session';

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ');

export async function GET() {
  const session = await getSession();
  if (!session || Object.keys(session).length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const committees = await prisma.committee.findMany({
      where: { cooperativeId: session.cooperativeId },
      include: {
        members: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    const normalized = committees.map(committee => ({
      ...committee,
      members: committee.members.map(member => normalizeName(`${member.firstName} ${member.lastName}`)),
    }));
    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error('Failed to load committees:', error);
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
    const validatedData = committeeSchema.parse(body);
    const tenantCandidates = await prisma.tenant.findMany({
      where: { status: 'Current', cooperativeId: session.cooperativeId },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameToId = new Map<string, string>();
    tenantCandidates.forEach(tenant => {
      nameToId.set(normalizeName(`${tenant.firstName} ${tenant.lastName}`), tenant.id);
    });
    const memberConnect = Array.from(new Set(validatedData.members ?? []))
      .map(name => nameToId.get(normalizeName(name)))
      .filter(Boolean)
      .map(id => ({ id: id as string }));
    const committee = await prisma.committee.create({
      data: {
        name: validatedData.name,
        description: validatedData.description ?? '',
        chair: validatedData.chair,
        icon: validatedData.icon ?? 'fa-users',
        cooperativeId: session.cooperativeId,
        members: memberConnect.length > 0 ? { connect: memberConnect } : undefined,
      },
    });
    const refreshed = await prisma.committee.findUnique({
      where: { id: committee.id },
      include: {
        members: {
          select: { firstName: true, lastName: true },
        },
      },
    });
    if (!refreshed) {
      return NextResponse.json({ error: 'Committee creation succeeded but could not be retrieved.' }, { status: 500 });
    }
    return NextResponse.json({
      ...refreshed,
      members: (refreshed.members ?? []).map(member => normalizeName(`${member.firstName} ${member.lastName}`)),
    });
  } catch (error: any) {
    console.error('Failed to save committee:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}