export const AUTO_DEMO_STORAGE_KEY = 'auto_demo_active';

export type AutoDemoAction = 'next' | 'switch-role';

export interface AutoDemoStop {
  id: string;
  route: string;
  target: string;
  title: string;
  body: string;
  sellingPoint: string;
  action?: AutoDemoAction;
}

export const AUTO_DEMO_STOPS: AutoDemoStop[] = [
  {
    id: 'mission-control',
    route: '/',
    target: 'dashboard-mission-control',
    title: 'Mission control for the board',
    body: 'Start with the operating snapshot: maintenance load, planned work, upcoming meetings, quick actions, documents, and building health are visible from one board workspace.',
    sellingPoint: 'Boards see what needs attention without chasing spreadsheets, inboxes, and separate file folders.',
  },
  {
    id: 'maintenance-ai',
    route: '/maintenance',
    target: 'maintenance-operations',
    title: 'Maintenance with AI-assisted triage',
    body: 'The maintenance queue brings resident requests, priority, status, unit context, attachments, and AI triage hints into one reviewable pipeline.',
    sellingPoint: 'Residents get a simple request path while boards get faster prioritization and a cleaner repair history.',
  },
  {
    id: 'unit-intelligence',
    route: '/admin/units/u1',
    target: 'unit-intelligence',
    title: 'Unit records with resident history',
    body: 'Each unit becomes a durable record of occupancy, member history, linked maintenance, documents, and operational notes.',
    sellingPoint: 'Co-ops keep institutional memory even as board members, residents, and committee roles change.',
  },
  {
    id: 'governance-archive',
    route: '/documents',
    target: 'governance-archive',
    title: 'Governance archive built for AI readiness',
    body: 'The document library organizes bylaws, policies, minutes, financial records, uploads, Drive-linked files, metadata, versions, and searchable archive status.',
    sellingPoint: 'Governance records stop being static files and become structured knowledge the co-op can actually use.',
  },
  {
    id: 'meeting-records',
    route: '/calendar/e1?tab=minutes',
    target: 'meeting-records',
    title: 'Meeting minutes become permanent records',
    body: 'Structured minutes capture attendance, motions, decisions, action items, linked documents, and PDF export so meetings flow directly into the archive.',
    sellingPoint: 'Boards reduce secretary workload while creating searchable, accountable records for future decisions.',
  },
  {
    id: 'policy-assistant',
    route: '/policy-assistant',
    target: 'policy-assistant',
    title: 'Policy answers from co-op records',
    body: 'The Policy Assistant is the payoff: once records are organized, board members and residents can ask natural-language questions about rules, policies, and governance context.',
    sellingPoint: 'The platform turns the co-op archive into practical guidance grounded in local documents.',
  },
  {
    id: 'resident-view',
    route: '/',
    target: 'role-switcher',
    title: 'One platform for board and residents',
    body: 'Switch into resident view to show personal requests, useful documents, community updates, meetings, committees, and self-service entry points.',
    sellingPoint: 'The same system supports board operations and member experience without separate portals.',
    action: 'switch-role',
  },
];

export const isAutoDemoStopIndex = (index: number) =>
  Number.isInteger(index) && index >= 0 && index < AUTO_DEMO_STOPS.length;

export const getAutoDemoStop = (index: number) =>
  isAutoDemoStopIndex(index) ? AUTO_DEMO_STOPS[index] : null;

export const getNextAutoDemoIndex = (index: number) =>
  Math.min(AUTO_DEMO_STOPS.length - 1, Math.max(0, index + 1));

export const getPreviousAutoDemoIndex = (index: number) =>
  Math.max(0, Math.min(AUTO_DEMO_STOPS.length - 1, index - 1));
