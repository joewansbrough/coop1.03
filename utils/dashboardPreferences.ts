export const DASHBOARD_PREFERENCE_VERSION = 1;

export type DashboardRole = 'admin' | 'resident';
export type DashboardTileSize = 'small' | 'wide' | 'tall' | 'large';

export type DashboardTileId =
  | 'maintenance-pulse'
  | 'building-map'
  | 'next-meeting'
  | 'announcement-digest'
  | 'document-watch'
  | 'waitlist-snapshot'
  | 'scheduled-maintenance'
  | 'quick-actions'
  | 'my-home'
  | 'my-requests'
  | 'community-updates'
  | 'useful-documents'
  | 'participation-prompts';

export interface DashboardTilePreference {
  id: DashboardTileId;
  size: DashboardTileSize;
  hidden: boolean;
}

export interface DashboardPreference {
  version: number;
  tiles: DashboardTilePreference[];
}

export interface DashboardTileDefinition {
  id: DashboardTileId;
  title: string;
  description: string;
  roles: DashboardRole[];
  defaultSize: DashboardTileSize;
  defaultSizes?: Partial<Record<DashboardRole, DashboardTileSize>>;
  allowedSizes: DashboardTileSize[];
  defaultOrder: Record<DashboardRole, number | null>;
}

export const DASHBOARD_TILE_REGISTRY: Record<DashboardTileId, DashboardTileDefinition> = {
  'maintenance-pulse': {
    id: 'maintenance-pulse',
    title: 'Maintenance Pulse',
    description: 'Open requests grouped by priority and status.',
    roles: ['admin'],
    defaultSize: 'large',
    allowedSizes: ['small', 'wide', 'large'],
    defaultOrder: { admin: 10, resident: null },
  },
  'building-map': {
    id: 'building-map',
    title: 'Building Map',
    description: 'Compact floor and unit health map.',
    roles: ['admin'],
    defaultSize: 'wide',
    allowedSizes: ['wide', 'large'],
    defaultOrder: { admin: 70, resident: null },
  },
  'next-meeting': {
    id: 'next-meeting',
    title: 'Next Meeting',
    description: 'Upcoming calendar meeting or community event.',
    roles: ['admin', 'resident'],
    defaultSize: 'wide',
    defaultSizes: { resident: 'small' },
    allowedSizes: ['small', 'wide', 'large'],
    defaultOrder: { admin: 40, resident: 20 },
  },
  'announcement-digest': {
    id: 'announcement-digest',
    title: 'Community Announcements',
    description: 'Urgent and recent community notices.',
    roles: ['admin'],
    defaultSize: 'large',
    allowedSizes: ['small', 'wide', 'large'],
    defaultOrder: { admin: 60, resident: null },
  },
  'document-watch': {
    id: 'document-watch',
    title: 'Document Library',
    description: 'Recently updated documents and archive readiness.',
    roles: ['admin'],
    defaultSize: 'wide',
    allowedSizes: ['small', 'wide', 'large'],
    defaultOrder: { admin: 50, resident: null },
  },
  'waitlist-snapshot': {
    id: 'waitlist-snapshot',
    title: 'Waitlist Snapshot',
    description: 'Waitlist size and follow-up prompt.',
    roles: ['admin'],
    defaultSize: 'wide',
    allowedSizes: ['small', 'wide'],
    defaultOrder: { admin: 80, resident: null },
  },
  'scheduled-maintenance': {
    id: 'scheduled-maintenance',
    title: 'Scheduled Maintenance',
    description: 'Upcoming planned work by urgency.',
    roles: ['admin'],
    defaultSize: 'wide',
    allowedSizes: ['small', 'wide', 'large'],
    defaultOrder: { admin: 30, resident: null },
  },
  'quick-actions': {
    id: 'quick-actions',
    title: 'Quick Actions',
    description: 'Frequently used dashboard actions.',
    roles: ['admin', 'resident'],
    defaultSize: 'wide',
    allowedSizes: ['small', 'wide'],
    defaultOrder: { admin: 20, resident: null },
  },
  'my-home': {
    id: 'my-home',
    title: 'My Home',
    description: 'Unit and residency context.',
    roles: ['resident'],
    defaultSize: 'small',
    allowedSizes: ['small', 'wide', 'large'],
    defaultOrder: { admin: null, resident: 10 },
  },
  'my-requests': {
    id: 'my-requests',
    title: 'My Requests',
    description: 'Active maintenance request timeline.',
    roles: ['resident'],
    defaultSize: 'large',
    allowedSizes: ['small', 'wide', 'large'],
    defaultOrder: { admin: null, resident: 30 },
  },
  'community-updates': {
    id: 'community-updates',
    title: 'Community Updates',
    description: 'Recent announcements and urgent notices.',
    roles: ['resident'],
    defaultSize: 'large',
    allowedSizes: ['wide', 'large'],
    defaultOrder: { admin: null, resident: 50 },
  },
  'useful-documents': {
    id: 'useful-documents',
    title: 'Useful Documents',
    description: 'Policies, forms, and recently updated records.',
    roles: ['resident'],
    defaultSize: 'large',
    allowedSizes: ['small', 'wide', 'large'],
    defaultOrder: { admin: null, resident: 60 },
  },
  'participation-prompts': {
    id: 'participation-prompts',
    title: 'Participation Prompts',
    description: 'Committee and event opportunities.',
    roles: ['resident'],
    defaultSize: 'wide',
    allowedSizes: ['small', 'wide'],
    defaultOrder: { admin: null, resident: null },
  },
};

const DEMO_STORAGE_PREFIX = 'demo_dashboard_preferences_';

const LEGACY_TILE_ID_MAP: Record<string, DashboardTileId> = {
  'next-community-event': 'next-meeting',
};

const isDashboardTileId = (id: unknown): id is DashboardTileId =>
  typeof id === 'string' && id in DASHBOARD_TILE_REGISTRY;

const resolveDashboardTileId = (id: unknown): DashboardTileId | null => {
  if (isDashboardTileId(id)) return id;
  if (typeof id === 'string') return LEGACY_TILE_ID_MAP[id] ?? null;
  return null;
};

const isDashboardTileSize = (size: unknown): size is DashboardTileSize =>
  size === 'small' || size === 'wide' || size === 'tall' || size === 'large';

const getDefaultDashboardTileSize = (
  tile: DashboardTileDefinition,
  role: DashboardRole,
): DashboardTileSize => tile.defaultSizes?.[role] ?? tile.defaultSize;

export const getAvailableDashboardTiles = (role: DashboardRole): DashboardTileDefinition[] =>
  Object.values(DASHBOARD_TILE_REGISTRY)
    .filter(tile => tile.roles.includes(role))
    .sort((a, b) => (a.defaultOrder[role] ?? 999) - (b.defaultOrder[role] ?? 999));

export const createDefaultDashboardLayout = (role: DashboardRole): DashboardPreference => ({
  version: DASHBOARD_PREFERENCE_VERSION,
  tiles: getAvailableDashboardTiles(role)
    .filter(tile => tile.defaultOrder[role] !== null)
    .map(tile => ({
      id: tile.id,
      size: getDefaultDashboardTileSize(tile, role),
      hidden: false,
    })),
});

export const normalizeDashboardPreference = (
  preference: unknown,
  role: DashboardRole,
): DashboardPreference => {
  const defaults = createDefaultDashboardLayout(role);
  const availableIds = new Set(getAvailableDashboardTiles(role).map(tile => tile.id));
  const seen = new Set<DashboardTileId>();
  const inputTiles = (
    typeof preference === 'object' &&
    preference !== null &&
    Array.isArray((preference as { tiles?: unknown }).tiles)
  )
    ? (preference as { tiles: unknown[] }).tiles
    : [];

  const normalizedTiles: DashboardTilePreference[] = [];

  for (const rawTile of inputTiles) {
    if (typeof rawTile !== 'object' || rawTile === null) continue;
    const tile = rawTile as { id?: unknown; size?: unknown; hidden?: unknown };
    const tileId = resolveDashboardTileId(tile.id);
    if (!tileId) continue;
    if (!availableIds.has(tileId)) continue;
    if (seen.has(tileId)) continue;
    seen.add(tileId);

    const definition = DASHBOARD_TILE_REGISTRY[tileId];
    const defaultSize = getDefaultDashboardTileSize(definition, role);
    const size = isDashboardTileSize(tile.size) && definition.allowedSizes.includes(tile.size)
      ? tile.size
      : defaultSize;

    normalizedTiles.push({
      id: tileId,
      size,
      hidden: tile.hidden === true,
    });
  }

  for (const defaultTile of defaults.tiles) {
    if (!seen.has(defaultTile.id)) normalizedTiles.push(defaultTile);
  }

  return {
    version: DASHBOARD_PREFERENCE_VERSION,
    tiles: normalizedTiles,
  };
};

export const loadDemoDashboardPreference = (role: DashboardRole): DashboardPreference | null => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(`${DEMO_STORAGE_PREFIX}${role}`);
  if (!raw) return null;
  try {
    return normalizeDashboardPreference(JSON.parse(raw), role);
  } catch {
    return null;
  }
};

export const saveDemoDashboardPreference = (role: DashboardRole, preference: DashboardPreference) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(
    `${DEMO_STORAGE_PREFIX}${role}`,
    JSON.stringify(normalizeDashboardPreference(preference, role)),
  );
};

export const moveDashboardTile = (
  preference: DashboardPreference,
  activeId: DashboardTileId,
  overId: DashboardTileId,
): DashboardPreference => {
  const fromIndex = preference.tiles.findIndex(tile => tile.id === activeId);
  const toIndex = preference.tiles.findIndex(tile => tile.id === overId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return preference;

  const tiles = [...preference.tiles];
  const [moved] = tiles.splice(fromIndex, 1);
  tiles.splice(toIndex, 0, moved);
  return { ...preference, tiles };
};

export const resizeDashboardTile = (
  preference: DashboardPreference,
  role: DashboardRole,
  tileId: DashboardTileId,
  size: DashboardTileSize,
): DashboardPreference => normalizeDashboardPreference({
  ...preference,
  tiles: preference.tiles.map(tile => (
    tile.id === tileId ? { ...tile, size } : tile
  )),
}, role);

export const hideDashboardTile = (
  preference: DashboardPreference,
  role: DashboardRole,
  tileId: DashboardTileId,
): DashboardPreference => normalizeDashboardPreference({
  ...preference,
  tiles: preference.tiles.map(tile => (
    tile.id === tileId ? { ...tile, hidden: true } : tile
  )),
}, role);

export const addDashboardTile = (
  preference: DashboardPreference,
  role: DashboardRole,
  tileId: DashboardTileId,
): DashboardPreference => {
  const definition = DASHBOARD_TILE_REGISTRY[tileId];
  if (!definition.roles.includes(role)) return normalizeDashboardPreference(preference, role);

  const existing = preference.tiles.find(tile => tile.id === tileId);
  if (existing) {
    return normalizeDashboardPreference({
      ...preference,
      tiles: preference.tiles.map(tile => (
        tile.id === tileId ? { ...tile, hidden: false } : tile
      )),
    }, role);
  }

  return normalizeDashboardPreference({
    ...preference,
    tiles: [
      ...preference.tiles,
      { id: tileId, size: getDefaultDashboardTileSize(definition, role), hidden: false },
    ],
  }, role);
};
