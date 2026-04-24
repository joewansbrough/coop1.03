/**
 * Utility to handle local persistence for Demo Mode.
 * This mimics a database in localStorage so users can create/update/delete 
 * data and see it persist across sessions.
 */

import * as demoData from './demoData';

const PREFIX = 'demo_v1_';

export const demoStorage = {
  // Generic get all
  getAll: <T>(key: string, initialData: T[]): T[] => {
    if (typeof window === 'undefined') return initialData;
    const saved = localStorage.getItem(PREFIX + key);
    if (!saved) {
      // Initialize with mock data if not already set
      localStorage.setItem(PREFIX + key, JSON.stringify(initialData));
      return initialData;
    }
    return JSON.parse(saved);
  },

  // Generic save all
  saveAll: <T>(key: string, data: T[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  },

  // Add item
  addItem: <T extends { id: string }>(key: string, initialData: T[], item: T): T => {
    const data = demoStorage.getAll(key, initialData);
    const newData = [...data, item];
    demoStorage.saveAll(key, newData);
    return item;
  },

  // Update item
  updateItem: <T extends { id: string }>(key: string, initialData: T[], item: T): T => {
    const data = demoStorage.getAll(key, initialData);
    const newData = data.map(i => i.id === item.id ? item : i);
    demoStorage.saveAll(key, newData);
    return item;
  },

  // Delete item
  deleteItem: <T extends { id: string }>(key: string, initialData: T[], id: string) => {
    const data = demoStorage.getAll(key, initialData);
    const newData = data.filter(i => i.id !== id);
    demoStorage.saveAll(key, newData);
  },

  // Specific helpers to avoid passing initialData everywhere
  getEvents: () => demoStorage.getAll('events', demoData.MOCK_EVENTS),
  addEvent: (event: any) => demoStorage.addItem('events', demoData.MOCK_EVENTS, event),
  updateEvent: (event: any) => demoStorage.updateItem('events', demoData.MOCK_EVENTS, event),
  deleteEvent: (id: string) => demoStorage.deleteItem('events', demoData.MOCK_EVENTS, id),

  getMaintenance: () => demoStorage.getAll('maintenance', demoData.MOCK_MAINTENANCE),
  addMaintenance: (req: any) => demoStorage.addItem('maintenance', demoData.MOCK_MAINTENANCE, req),
  updateMaintenance: (req: any) => demoStorage.updateItem('maintenance', demoData.MOCK_MAINTENANCE, req),
  deleteMaintenance: (id: string) => demoStorage.deleteItem('maintenance', demoData.MOCK_MAINTENANCE, id),

  getAnnouncements: () => demoStorage.getAll('announcements', demoData.MOCK_ANNOUNCEMENTS),
  addAnnouncement: (ann: any) => demoStorage.addItem('announcements', demoData.MOCK_ANNOUNCEMENTS, ann),
  updateAnnouncement: (ann: any) => demoStorage.updateItem('announcements', demoData.MOCK_ANNOUNCEMENTS, ann),
  deleteAnnouncement: (id: string) => demoStorage.deleteItem('announcements', demoData.MOCK_ANNOUNCEMENTS, id),

  getTenants: () => demoStorage.getAll('tenants', demoData.MOCK_TENANTS),
  addTenant: (tenant: any) => demoStorage.addItem('tenants', demoData.MOCK_TENANTS, tenant),
  updateTenant: (tenant: any) => demoStorage.updateItem('tenants', demoData.MOCK_TENANTS, tenant),
  deleteTenant: (id: string) => demoStorage.deleteItem('tenants', demoData.MOCK_TENANTS, id),

  getUnits: () => demoStorage.getAll('units', demoData.MOCK_UNITS),
  updateUnit: (unit: any) => demoStorage.updateItem('units', demoData.MOCK_UNITS, unit),

  // Turnover Management
  moveIn: (unitId: string, tenantId: string, date: string) => {
    const units = demoStorage.getUnits();
    const tenants = demoStorage.getTenants();
    const unit = units.find(u => u.id === unitId);
    const tenant = tenants.find(t => t.id === tenantId);

    if (!unit || !tenant) return;

    // 1. Update Tenant
    const updatedTenant = {
      ...tenant,
      unitId,
      status: 'Current',
      startDate: date,
      endDate: undefined,
      history: [
        ...(tenant.history || []),
        { id: `h-${Date.now()}`, tenantId, unitId, unit: { number: unit.number }, startDate: date }
      ]
    };
    demoStorage.updateTenant(updatedTenant);

    // 2. Update Unit
    const updatedUnit = {
      ...unit,
      status: 'Occupied',
      currentTenantId: tenantId
    };
    demoStorage.updateUnit(updatedUnit);
  },

  moveOut: (unitId: string, date: string, reason: string) => {
    const units = demoStorage.getUnits();
    const tenants = demoStorage.getTenants();
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    // 1. Update all residents of this unit
    const residents = tenants.filter(t => t.unitId === unitId);
    residents.forEach(t => {
      const updatedTenant = {
        ...t,
        status: 'Past',
        endDate: date,
        unitId: null,
        history: (t.history || []).map(rh => 
          rh.unitId === unitId && !rh.endDate ? { ...rh, endDate: date, moveReason: reason } : rh
        )
      };
      demoStorage.updateTenant(updatedTenant);
    });

    // 2. Update Unit
    const updatedUnit = {
      ...unit,
      status: 'Vacant',
      currentTenantId: undefined
    };
    demoStorage.updateUnit(updatedUnit);
  },

  transfer: (fromUnitId: string, toUnitId: string, date: string) => {
    const units = demoStorage.getUnits();
    const tenants = demoStorage.getTenants();
    const fromUnit = units.find(u => u.id === fromUnitId);
    const toUnit = units.find(u => u.id === toUnitId);
    if (!fromUnit || !toUnit) return;

    // 1. Update all residents of fromUnit
    const residents = tenants.filter(t => t.unitId === fromUnitId);
    residents.forEach(t => {
      const archivedHistory = (t.history || []).map(rh => 
        rh.unitId === fromUnitId && !rh.endDate ? { ...rh, endDate: date, moveReason: 'Internal Transfer' } : rh
      );
      const updatedTenant = {
        ...t,
        unitId: toUnitId,
        startDate: date,
        history: [
          ...archivedHistory,
          { id: `h-${Date.now()}-${t.id}`, tenantId: t.id, unitId: toUnitId, unit: { number: toUnit.number }, startDate: date }
        ]
      };
      demoStorage.updateTenant(updatedTenant);
    });

    // 2. Update Units
    demoStorage.updateUnit({ ...fromUnit, status: 'Vacant', currentTenantId: undefined });
    demoStorage.updateUnit({ ...toUnit, status: 'Occupied', currentTenantId: residents[0]?.id });
  }
};
