import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../utils/prisma';
import { getSession } from '../../../utils/session';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper to get Gemini
const getAI = () => new GoogleGenerativeAI(process.env.API_KEY || '');

export async function GET(request: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  const { route } = await params;
  const session = await getSession();

  // GET /api/units/:id/scheduled-maintenance
  if (route.length === 3 && route[0] === 'units' && route[2] === 'scheduled-maintenance') {
    const unitId = route[1];
    const tasks = await prisma.scheduledMaintenance.findMany({
      where: { unitId },
      orderBy: { dueDate: 'asc' }
    });
    return NextResponse.json(tasks);
  }

  // GET /api/tenants/:id
  if (route.length === 2 && route[0] === 'tenants') {
    const id = route[1];
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { unit: true, history: { include: { unit: true }, orderBy: { startDate: 'desc' } } }
    });
    return NextResponse.json(tenant);
  }

  // GET /api/maintenance/:id
  if (route.length === 2 && route[0] === 'maintenance') {
    const id = route[1];
    const req = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: { unit: true }
    });
    return NextResponse.json(req);
  }

  // GET /api/seed/preventative
  if (route.length === 2 && route[0] === 'seed' && route[1] === 'preventative') {
    if (!session.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const units = await prisma.unit.findMany();
    const tasks = [];
    for (const unit of units) {
      const unitTasks = [
        { unitId: unit.id, task: 'Fire Alarm Test', frequency: 'ANNUAL', category: 'SAFETY', dueDate: new Date('2026-12-01') },
        { unitId: unit.id, task: 'HVAC Filter Change', frequency: 'QUARTERLY', category: 'HVAC', dueDate: new Date('2026-06-01') },
        { unitId: unit.id, task: 'Balcony Inspection', frequency: 'ANNUAL', category: 'STRUCTURAL', dueDate: new Date('2026-08-15') },
      ];
      for (const t of unitTasks) {
        tasks.push(await prisma.scheduledMaintenance.create({ data: t as any }));
      }
    }
    return NextResponse.json({ success: true, count: tasks.length });
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  const { route } = await params;
  const session = await getSession();
  const body = await request.json();

  // POST /api/units/:id/move-out
  if (route.length === 3 && route[0] === 'units' && route[2] === 'move-out') {
    if (!session.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const unitId = route[1];
    const { date, reason } = body;

    // Update all current residents
    await prisma.tenant.updateMany({
      where: { unitId, status: 'Current' },
      data: { status: 'Past', unitId: null, endDate: new Date(date) }
    });

    // Archive history
    await prisma.tenantHistory.updateMany({
      where: { unitId, endDate: null },
      data: { endDate: new Date(date), moveReason: reason || 'Move-Out' }
    });

    // Make unit vacant
    await prisma.unit.update({
      where: { id: unitId },
      data: { status: 'Vacant', currentTenantId: null }
    });

    return NextResponse.json({ success: true });
  }

  // POST /api/units/:id/move-in
  if (route.length === 3 && route[0] === 'units' && route[2] === 'move-in') {
    if (!session.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const unitId = route[1];
    const { tenantId, date } = body;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    // Handle internal transfer if already in a unit
    if (tenant.unitId) {
      await prisma.tenantHistory.updateMany({
        where: { tenantId, endDate: null },
        data: { endDate: new Date(date), moveReason: 'Internal Transfer' }
      });
      await prisma.unit.update({
        where: { id: tenant.unitId },
        data: { status: 'Vacant', currentTenantId: null }
      });
    }

    // Assign to new unit
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { unitId, status: 'Current', startDate: new Date(date), endDate: null }
    });

    await prisma.unit.update({
      where: { id: unitId },
      data: { status: 'Occupied', currentTenantId: tenantId }
    });

    await prisma.tenantHistory.create({
      data: { tenantId, unitId, startDate: new Date(date) }
    });

    return NextResponse.json({ success: true });
  }

  // POST /api/units/:id/transfer
  if (route.length === 3 && route[0] === 'units' && route[2] === 'transfer') {
    if (!session.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const { fromUnitId, toUnitId, date } = body;

    const residents = await prisma.tenant.findMany({ where: { unitId: fromUnitId, status: 'Current' } });
    
    for (const res of residents) {
      await prisma.tenantHistory.updateMany({
        where: { tenantId: res.id, unitId: fromUnitId, endDate: null },
        data: { endDate: new Date(date), moveReason: 'Internal Transfer' }
      });
      await prisma.tenant.update({
        where: { id: res.id },
        data: { unitId: toUnitId, startDate: new Date(date) }
      });
      await prisma.tenantHistory.create({
        data: { tenantId: res.id, unitId: toUnitId, startDate: new Date(date) }
      });
    }

    await prisma.unit.update({ where: { id: fromUnitId }, data: { status: 'Vacant', currentTenantId: null } });
    await prisma.unit.update({ where: { id: toUnitId }, data: { status: 'Occupied', currentTenantId: residents[0]?.id } });

    return NextResponse.json({ success: true });
  }

  // POST /api/ai/triage
  if (route.length === 2 && route[0] === 'ai' && route[1] === 'triage') {
    const { description } = body;
    const model = getAI().getGenerativeModel({ model: session.geminiModel || 'gemini-2.0-flash-lite' });
    const result = await model.generateContent(`Evaluate the following maintenance request for a BC housing co-op and return a suggested urgency level (Low, Medium, High, Emergency) and a category (Plumbing, Electrical, Structural, Appliance, Other). Request: "${description}"`);
    const response = await result.response;
    return NextResponse.json(JSON.parse(response.text() || '{}'));
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  const { route } = await params;
  const session = await getSession();
  const body = await request.json();

  // PUT /api/maintenance/:id
  if (route.length === 2 && route[0] === 'maintenance') {
    const id = route[1];
    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: body.status,
        priority: body.priority,
        category: body.category,
        notes: body.notes,
        expenses: body.expenses,
        updatedAt: new Date()
      }
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  const { route } = await params;
  const session = await getSession();

  // DELETE /api/maintenance/:id
  if (route.length === 2 && route[0] === 'maintenance') {
    if (!session.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    await prisma.maintenanceRequest.delete({ where: { id: route[1] } });
    return NextResponse.json({ success: true });
  }

  // DELETE /api/events/:id
  if (route.length === 2 && route[0] === 'events') {
    if (!session.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    await prisma.coopEvent.delete({ where: { id: route[1] } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}
