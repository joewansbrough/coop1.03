export const TENANT_TEMPLATE_COLUMNS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'unitNumber',
  'role',
  'status',
  'moveInDate',
  'emergencyContactName',
  'emergencyContactPhone',
  'parkingStall',
  'storageLocker',
  'notes',
] as const;

export type TenantTemplateColumn = typeof TENANT_TEMPLATE_COLUMNS[number];

export type TenantImportRow = Record<TenantTemplateColumn, string>;

export type ExistingImportUnit = {
  id: string;
  number: string;
  currentTenantId?: string | null;
};

export type ExistingImportTenant = {
  id: string;
  email: string;
  unitId?: string | null;
};

export type TenantImportPreviewRow = TenantImportRow & {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  unitId: string | null;
  existingTenantId: string | null;
};

export type TenantImportPreview = {
  rows: TenantImportPreviewRow[];
  validRows: number;
  errorRows: number;
  warningRows: number;
};

const sampleRows = [
  TENANT_TEMPLATE_COLUMNS,
  ['Ada', 'Lovelace', 'ada@example.com', '250-000-0000', '101', 'MEMBER', 'Current', '2026-01-15', '', '', '', '', ''],
  ['Grace', 'Hopper', 'grace@example.com', '250-000-0001', '102', 'BOARD', 'Current', '2026-01-16', '', '', '', '', ''],
];

const csvEscape = (value: string | number) => {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const normalizeRole = (value: string) => {
  const role = value.trim().toUpperCase();
  if (!role) return 'MEMBER';
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'BOARD' || role === 'BOARD_MEMBER') return 'BOARD';
  if (role === 'MEMBER') return 'MEMBER';
  return role;
};

const normalizeStatus = (value: string) => {
  const status = value.trim().toLowerCase();
  if (!status) return 'Current';
  if (status === 'pending') return 'Pending';
  if (status === 'former' || status === 'past') return 'Past';
  if (status === 'waitlist') return 'Waitlist';
  if (status === 'current') return 'Current';
  return value.trim();
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidDateString = (value: string) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
};

const normalizeRow = (row: Partial<Record<TenantTemplateColumn, string>>): TenantImportRow => ({
  firstName: String(row.firstName || '').trim(),
  lastName: String(row.lastName || '').trim(),
  email: normalizeEmail(String(row.email || '')),
  phone: String(row.phone || '').trim(),
  unitNumber: String(row.unitNumber || '').trim(),
  role: normalizeRole(String(row.role || 'MEMBER')),
  status: normalizeStatus(String(row.status || 'Current')),
  moveInDate: String(row.moveInDate || '').trim(),
  emergencyContactName: String(row.emergencyContactName || '').trim(),
  emergencyContactPhone: String(row.emergencyContactPhone || '').trim(),
  parkingStall: String(row.parkingStall || '').trim(),
  storageLocker: String(row.storageLocker || '').trim(),
  notes: String(row.notes || '').trim(),
});

export const buildTenantTemplateCsv = () =>
  sampleRows.map(row => row.map(csvEscape).join(',')).join('\n');

export const parseTenantImportCsv = (csv: string): TenantImportRow[] => {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(header => header.trim());
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line);
    const raw: Partial<Record<TenantTemplateColumn, string>> = {};
    headers.forEach((header, index) => {
      if ((TENANT_TEMPLATE_COLUMNS as readonly string[]).includes(header)) {
        raw[header as TenantTemplateColumn] = cells[index] || '';
      }
    });
    return normalizeRow(raw);
  });
};

export const validateTenantImportRows = (
  rows: TenantImportRow[],
  context: {
    existingUnits: ExistingImportUnit[];
    existingTenants: ExistingImportTenant[];
  },
): TenantImportPreview => {
  const unitsByNumber = new Map(context.existingUnits.map(unit => [unit.number.trim(), unit]));
  const tenantsByEmail = new Map(context.existingTenants.map(tenant => [normalizeEmail(tenant.email), tenant]));
  const firstUploadEmailIndex = rows.reduce((indexes, row, index) => {
    if (!row.email || indexes.has(row.email)) return indexes;
    indexes.set(row.email, index);
    return indexes;
  }, new Map<string, number>());

  const previewRows = rows.map((row, index): TenantImportPreviewRow => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const unit = row.unitNumber ? unitsByNumber.get(row.unitNumber) : null;
    const existingTenant = row.email ? tenantsByEmail.get(row.email) : null;

    if (!row.firstName) errors.push('First name is required.');
    if (!row.lastName) errors.push('Last name is required.');
    if (!row.email) errors.push('Email is required.');
    else if (!isValidEmail(row.email)) errors.push('Email must be valid.');
    if (row.email && firstUploadEmailIndex.get(row.email) !== index) errors.push('Duplicate email in upload.');
    if (!row.unitNumber) errors.push('Unit number is required.');
    else if (!unit) errors.push(`Unit number ${row.unitNumber} does not exist.`);
    if (!isValidDateString(row.moveInDate)) errors.push('Move-in date must be a valid date.');
    if (!['ADMIN', 'BOARD', 'MEMBER'].includes(row.role)) errors.push(`Role ${row.role} is not supported.`);
    if (!['Current', 'Pending', 'Past', 'Waitlist'].includes(row.status)) errors.push(`Status ${row.status} is not supported.`);

    if (existingTenant) warnings.push('Existing member will be updated.');
    if (unit?.currentTenantId && unit.currentTenantId !== existingTenant?.id && row.status === 'Current') {
      warnings.push(`Unit ${unit.number} already has an active occupant.`);
    }

    return {
      ...row,
      rowNumber: index + 2,
      valid: errors.length === 0,
      errors,
      warnings,
      unitId: unit?.id || null,
      existingTenantId: existingTenant?.id || null,
    };
  });

  return {
    rows: previewRows,
    validRows: previewRows.filter(row => row.valid).length,
    errorRows: previewRows.filter(row => row.errors.length > 0).length,
    warningRows: previewRows.filter(row => row.warnings.length > 0).length,
  };
};
