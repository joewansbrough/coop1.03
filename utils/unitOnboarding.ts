import type { Unit } from '../types';

export const UNIT_TEMPLATE_COLUMNS = [
  'unitNumber',
  'buildingName',
  'floor',
  'unitType',
  'status',
] as const;

export type UnitTemplateColumn = typeof UNIT_TEMPLATE_COLUMNS[number];

export type UnitTemplateRowInput = Partial<Record<UnitTemplateColumn, string | number | null | undefined>>;

export type NormalizedUnitTemplateRow = {
  unitNumber: string;
  buildingName: string;
  floor: number;
  unitType: string;
  status: string;
};

export type UnitSetupState = {
  isEmpty: boolean;
  title: string;
  description: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
};

const csvRows = [
  UNIT_TEMPLATE_COLUMNS,
  ['101', 'Main Building', '1', '1BR', 'Vacant'],
  ['102', 'Main Building', '1', '2BR', 'Vacant'],
  ['201', 'Main Building', '2', '2BR', 'Vacant'],
];

const csvEscape = (value: string | number) => {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toTitleCaseStatus = (value: unknown) => {
  const text = String(value || 'Vacant').trim().toLowerCase();
  if (text === 'occupied') return 'Occupied';
  if (text === 'maintenance') return 'Maintenance';
  return 'Vacant';
};

export const buildUnitTemplateCsv = () =>
  csvRows.map(row => row.map(csvEscape).join(',')).join('\n');

export const normalizeUnitTemplateRow = (row: UnitTemplateRowInput): NormalizedUnitTemplateRow => {
  const parsedFloor = Number(row.floor);
  return {
    unitNumber: String(row.unitNumber || '').trim(),
    buildingName: String(row.buildingName || '').trim(),
    floor: Number.isFinite(parsedFloor) && parsedFloor > 0 ? parsedFloor : 1,
    unitType: String(row.unitType || '2BR').trim().toUpperCase() || '2BR',
    status: toTitleCaseStatus(row.status),
  };
};

export const getUnitSetupState = (units: ReadonlyArray<Partial<Unit>>): UnitSetupState => {
  if (units.length > 0) {
    return {
      isEmpty: false,
      title: 'Units are ready for member import',
      description: 'The unit backbone exists. Keep it current before importing or assigning members.',
      primaryActionLabel: 'Add unit',
      secondaryActionLabel: 'Download unit template',
    };
  }

  return {
    isEmpty: true,
    title: 'Create the unit backbone first',
    description: 'Units are the assignment target for member import, maintenance requests, occupancy history, and dashboard reporting.',
    primaryActionLabel: 'Add first unit',
    secondaryActionLabel: 'Download unit template',
  };
};

export const findMissingUnitNumbers = (
  existingUnits: ReadonlyArray<Pick<Unit, 'number'>>,
  requestedUnitNumbers: ReadonlyArray<string | null | undefined>,
) => {
  const existing = new Set(existingUnits.map(unit => unit.number.trim()).filter(Boolean));
  const missing: string[] = [];
  const seen = new Set<string>();

  for (const value of requestedUnitNumbers) {
    const unitNumber = String(value || '').trim();
    if (!unitNumber || existing.has(unitNumber) || seen.has(unitNumber)) continue;
    seen.add(unitNumber);
    missing.push(unitNumber);
  }

  return missing;
};
