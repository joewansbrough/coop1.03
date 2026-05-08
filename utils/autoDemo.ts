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
    id: 'welcome',
    route: '/',
    target: 'dashboard-mission-control',
    title: 'Welcome to the guided demo',
    body: 'This short walkthrough follows connected work across the co-op: community spaces, meetings, records, maintenance, units, and resident self-service. You can drag this window out of the way while you explore.',
    customerValue: 'New customers get oriented before the tour starts, with enough context to understand how the pieces fit together.',
    scrollMode: 'top',
  },
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
    id: 'calendar-space',
    route: '/calendar',
    target: 'calendar-page',
    title: 'A shared community calendar',
    body: 'The calendar combines board meetings, community events, maintenance windows, committee activity, imports, and exports in one place.',
    customerValue: 'Residents have fewer places to check, and boards can turn dates into working records instead of isolated reminders.',
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
    id: 'open-linked-documents',
    route: '/calendar/e1?tab=minutes',
    target: 'meeting-documents-link',
    title: 'Open linked documents',
    body: 'The meeting record can jump directly to the document library, showing how minutes, attachments, bylaws, and governance records connect.',
    customerValue: 'Customers see the practical path from calendar to meeting to archive, without duplicate filing work.',
    routeAfterClick: '/documents',
    scrollMode: 'target',
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
    id: 'open-committees',
    route: '/',
    target: 'nav-committees',
    title: 'Open community spaces',
    body: 'Beyond records, the demo moves into the community tools that help people participate: committees and communications.',
    customerValue: 'The platform supports belonging and shared work, not only administration.',
    routeAfterClick: '/committees',
    scrollMode: 'top',
  },
  {
    id: 'committee-space',
    route: '/committees',
    target: 'community-committees',
    title: 'Committees keep work organized',
    body: 'Committee pages gather members, meetings, documents, and responsibilities so work can continue between board meetings.',
    customerValue: 'Volunteer energy is easier to direct when every committee has a visible home and a clear set of records.',
    scrollMode: 'top',
  },
  {
    id: 'open-communications',
    route: '/',
    target: 'nav-communications',
    title: 'Open communications',
    body: 'The tour also shows where announcements and building-wide updates live, so residents know where to look for current information.',
    customerValue: 'Fewer missed updates means less confusion and a stronger sense that the co-op is communicating in one voice.',
    routeAfterClick: '/communications',
    scrollMode: 'top',
  },
  {
    id: 'communications-space',
    route: '/communications',
    target: 'community-communications',
    title: 'Broadcasts in one place',
    body: 'Communications centralize urgent notices, routine updates, authorship, and announcement history.',
    customerValue: 'Residents do not have to piece together messages from hallway notes, email chains, and old chat threads.',
    scrollMode: 'top',
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
    id: 'maintenance-status',
    route: '/admin/maintenance/m1',
    target: 'maintenance-status-in-progress',
    title: 'Move work from pending to in progress',
    body: 'Workflow controls make it clear when a request has been reviewed, assigned, started, completed, or cancelled.',
    customerValue: 'Residents and boards get a shared source of truth instead of wondering whether anyone has picked up the issue.',
    scrollMode: 'target',
  },
  {
    id: 'maintenance-update-log',
    route: '/admin/maintenance/m1',
    target: 'maintenance-update-log',
    title: 'Log staff updates',
    body: 'Maintenance staff can add updates as work happens, creating a communication trail that stays attached to the request.',
    customerValue: 'This reduces repeated follow-up and keeps future boards from losing the story behind a repair.',
    scrollMode: 'target',
  },
  {
    id: 'maintenance-categories',
    route: '/admin/maintenance/m1',
    target: 'maintenance-category-tags',
    title: 'Tag the type of work',
    body: 'Categories such as plumbing, appliance, safety, and exterior help the co-op sort work and understand what types of issues recur.',
    customerValue: 'Better categorization makes reporting, prioritization, and preventative planning easier over time.',
    scrollMode: 'target',
  },
  {
    id: 'maintenance-export',
    route: '/admin/maintenance/m1',
    target: 'maintenance-export-pdf',
    title: 'Export a complete work order',
    body: 'The request can be exported to PDF with the unit, resident, status, notes, and supporting record in one package.',
    customerValue: 'Boards can share or archive a clean record without manually assembling screenshots and emails.',
    scrollMode: 'target',
  },
  {
    id: 'open-unit-from-maintenance',
    route: '/admin/maintenance/m1',
    target: 'maintenance-unit-link',
    title: 'Open the connected unit',
    body: 'Instead of jumping randomly to the Unit page, the demo follows the Unit link inside the maintenance request.',
    customerValue: 'Customers can see how one object leads to the next: request, unit, resident, documents, and history.',
    routeAfterClick: '/admin/units/u1',
    scrollMode: 'target',
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
    id: 'unit-maintenance-tab',
    route: '/admin/units/u1',
    target: 'unit-tab-maintenance',
    title: 'Open service history',
    body: 'The unit tabs organize different kinds of information without making users leave the unit record.',
    customerValue: 'A board member can understand the service story of a unit without searching the maintenance queue separately.',
    routeAfterClick: '/admin/units/u1?tab=maintenance',
    scrollMode: 'top',
  },
  {
    id: 'unit-schedule-tab',
    route: '/admin/units/u1?tab=maintenance',
    target: 'unit-tab-schedule',
    title: 'Open preventative maintenance',
    body: 'Preventative schedules keep recurring inspections and safety tasks visible alongside the unit they affect.',
    customerValue: 'This helps co-ops move from reactive repairs toward planned building care.',
    routeAfterClick: '/admin/units/u1?tab=schedule',
    scrollMode: 'top',
  },
  {
    id: 'unit-members-tab',
    route: '/admin/units/u1?tab=schedule',
    target: 'unit-tab-occupancy',
    title: 'Open household members',
    body: 'The Members tab shows the current household and profile links for the people connected to the unit.',
    customerValue: 'The board can understand who is connected to a unit while keeping that context tied to the right record.',
    routeAfterClick: '/admin/units/u1?tab=occupancy',
    scrollMode: 'top',
  },
  {
    id: 'unit-documents-tab',
    route: '/admin/units/u1?tab=occupancy',
    target: 'unit-tab-documents',
    title: 'Open unit documents',
    body: 'The Documents tab keeps inspection files, unit records, and cloud-linked documents attached to the unit.',
    customerValue: 'Important unit information is easier to find years later, even after board turnover.',
    routeAfterClick: '/admin/units/u1?tab=documents',
    scrollMode: 'top',
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
