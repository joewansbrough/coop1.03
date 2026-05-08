export const AUTO_DEMO_STORAGE_KEY = 'auto_demo_active';

export const AUTO_DEMO_TIMING = {
  measureDelayMs: 450,
  cursorTravelMs: 1200,
  arrivalHoldMs: 650,
  panelDelayMs: 1850,
  clickPulseMs: 650,
} as const;

export type AutoDemoAction = 'switch-role';
export type AutoDemoScrollMode = 'top' | 'target' | 'dashboard-preview';

export interface AutoDemoStop {
  id: string;
  route: string;
  target: string;
  title: string;
  body: string;
  customerValue: string;
  routeAfterClick?: string;
  scrollMode?: AutoDemoScrollMode;
  action?: AutoDemoAction;
}

export const AUTO_DEMO_STOPS: AutoDemoStop[] = [
  {
    id: 'mission-control',
    route: '/',
    target: 'dashboard-mission-control',
    title: 'Mission control for the board',
    body: 'Start at the top of the board dashboard, where the day begins with maintenance load, planned work, upcoming meetings, quick actions, documents, and building health in one workspace.',
    customerValue: 'Board members save time because the important work is gathered before the meeting starts, instead of scattered across inboxes, spreadsheets, and file folders.',
    scrollMode: 'dashboard-preview',
  },
  {
    id: 'open-maintenance',
    route: '/',
    target: 'nav-maintenance',
    title: 'Open maintenance from the sidebar',
    body: 'The guided demo follows the same path a board member would use: move to Maintenance in the sidebar, click it, and enter the shared maintenance workspace.',
    customerValue: 'New users can see where the feature lives, so the demo teaches the product instead of teleporting between screens.',
    routeAfterClick: '/maintenance',
    scrollMode: 'top',
  },
  {
    id: 'maintenance-queue',
    route: '/maintenance',
    target: 'maintenance-operations',
    title: 'A shared maintenance queue',
    body: 'The queue shows open work, status, priority, unit context, AI triage hints, and recent history so the maintenance committee can decide what needs attention next.',
    customerValue: 'Residents get a simple place to report problems, and volunteers spend less time reconstructing the story before assigning work.',
    scrollMode: 'top',
  },
  {
    id: 'open-maintenance-detail',
    route: '/maintenance',
    target: 'maintenance-first-request',
    title: 'Open the actual work order',
    body: 'A request is not just a row in a table. The demo opens the work order so customers can see the whole maintenance record behind it.',
    customerValue: 'Every repair can carry the unit, resident, notes, attachments, PDF export, and status history forward for the next board or committee.',
    routeAfterClick: '/admin/maintenance/m1',
  },
  {
    id: 'maintenance-detail',
    route: '/admin/maintenance/m1',
    target: 'maintenance-detail-record',
    title: 'The complete repair record',
    body: 'Inside the work order, staff can review workflow stage, priority, category, unit, resident, activity notes, and exportable documentation.',
    customerValue: 'This reduces repeat questions and helps the co-op keep a clean institutional memory for maintenance decisions.',
    scrollMode: 'top',
  },
  {
    id: 'unit-intelligence',
    route: '/admin/units/u1',
    target: 'unit-intelligence',
    title: 'Unit records with resident history',
    body: 'Each unit becomes a durable record of occupancy, member history, linked maintenance, documents, and operational notes.',
    customerValue: 'Co-ops keep continuity even as board members, residents, and committee roles change over time.',
    scrollMode: 'top',
  },
  {
    id: 'governance-archive',
    route: '/documents',
    target: 'governance-archive',
    title: 'One home for governance records',
    body: 'The document library organizes bylaws, policies, minutes, financial records, uploads, Drive-linked files, metadata, versions, and searchable archive status.',
    customerValue: 'The co-op gets fewer lost documents, fewer repeated questions, and a clearer path from records to answers.',
    scrollMode: 'top',
  },
  {
    id: 'open-calendar',
    route: '/',
    target: 'nav-calendar',
    title: 'Open the community calendar',
    body: 'Meeting work starts where people already look for events: the Calendar. The demo opens it from the sidebar so the navigation path is clear.',
    customerValue: 'Boards and residents share one calendar for governance, maintenance, and community events, which makes participation easier.',
    routeAfterClick: '/calendar',
    scrollMode: 'top',
  },
  {
    id: 'open-calendar-event',
    route: '/calendar',
    target: 'calendar-demo-event',
    title: 'Open an event record',
    body: 'From the calendar, the demo opens an AGM event. This is where meeting details, attendance, and minutes live together.',
    customerValue: 'The calendar stops being just a date list and becomes a clear path from event to shared community record.',
    routeAfterClick: '/calendar/e1',
    scrollMode: 'top',
  },
  {
    id: 'open-meeting-minutes',
    route: '/calendar/e1',
    target: 'meeting-minutes-tab',
    title: 'Open the Meeting Minutes tab',
    body: 'The demo moves from the event details into the Meeting Minutes tab, following the same path a secretary or board chair would use after a meeting.',
    customerValue: 'Minutes are attached to the meeting itself, so the record is easier to find and easier to finish.',
    routeAfterClick: '/calendar/e1?tab=minutes',
    scrollMode: 'top',
  },
  {
    id: 'meeting-record-actions',
    route: '/calendar/e1?tab=minutes',
    target: 'meeting-record-actions',
    title: 'Edit, export, and connect records',
    body: 'Meeting minutes can be edited, exported to PDF, and connected back to the document library so decisions do not disappear after the meeting ends.',
    customerValue: 'This frees up secretary time, keeps decisions accountable, and builds a usable archive for future board members.',
    scrollMode: 'target',
  },
  {
    id: 'policy-assistant',
    route: '/policy-assistant',
    target: 'policy-assistant',
    title: 'Policy answers from co-op records',
    body: 'The Policy Assistant is the payoff: once records are organized, board members and residents can ask natural-language questions about rules, policies, and governance context.',
    customerValue: 'Instead of digging through PDFs during a meeting, people can get a faster starting point grounded in the co-op archive.',
    scrollMode: 'top',
  },
  {
    id: 'resident-view',
    route: '/',
    target: 'role-switcher',
    title: 'One platform for board and residents',
    body: 'Switch into resident view to show personal requests, useful documents, community updates, meetings, committees, and self-service entry points.',
    customerValue: 'The same system supports board work and resident experience, helping the co-op feel more transparent, organized, and connected.',
    scrollMode: 'top',
    action: 'switch-role',
  },
];

export interface AutoDemoPanelPlacementInput {
  rect: { top: number; left: number; width: number; height: number };
  viewportWidth: number;
  viewportHeight: number;
  panelWidth?: number;
  panelHeight?: number;
  margin?: number;
}

export const getAutoDemoPanelPlacement = ({
  rect,
  viewportWidth,
  viewportHeight,
  panelWidth = 360,
  panelHeight = 420,
  margin = 16,
}: AutoDemoPanelPlacementInput) => {
  const effectiveWidth = Math.min(panelWidth, Math.max(240, viewportWidth - margin * 2));
  const effectiveHeight = Math.min(panelHeight, Math.max(240, viewportHeight - margin * 2));
  const placeRight = rect.left + rect.width + effectiveWidth + margin < viewportWidth;
  const placeLeft = rect.left - effectiveWidth - margin > margin;
  const preferredLeft = placeRight
    ? rect.left + rect.width + margin
    : placeLeft
      ? rect.left - effectiveWidth - margin
      : rect.left;

  return {
    left: Math.max(margin, Math.min(viewportWidth - effectiveWidth - margin, preferredLeft)),
    top: Math.max(margin, Math.min(viewportHeight - effectiveHeight - margin, rect.top)),
    width: effectiveWidth,
    maxHeight: Math.max(240, viewportHeight - margin * 2),
  };
};

export const isAutoDemoStopIndex = (index: number) =>
  Number.isInteger(index) && index >= 0 && index < AUTO_DEMO_STOPS.length;

export const getAutoDemoStop = (index: number) =>
  isAutoDemoStopIndex(index) ? AUTO_DEMO_STOPS[index] : null;

export const getNextAutoDemoIndex = (index: number) =>
  Math.min(AUTO_DEMO_STOPS.length - 1, Math.max(0, index + 1));

export const getPreviousAutoDemoIndex = (index: number) =>
  Math.max(0, Math.min(AUTO_DEMO_STOPS.length - 1, index - 1));
