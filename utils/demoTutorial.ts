export type DemoTutorialTrackId = 'admin' | 'resident' | 'pitch';

export type DemoTutorialEvent =
  | 'unit_opened'
  | 'maintenance_opened'
  | 'maintenance_submitted'
  | 'minutes_saved'
  | 'document_opened'
  | 'policy_question_asked'
  | 'role_switched';

export interface DemoTutorialStep {
  id: string;
  title: string;
  description: string;
  route: string;
  matchRoutes?: string[];
  eventName?: DemoTutorialEvent;
}

export interface DemoTutorialTrack {
  id: DemoTutorialTrackId;
  title: string;
  subtitle: string;
  startPath: string;
  startAsResident: boolean;
  steps: DemoTutorialStep[];
}

export interface DemoTutorialState {
  trackId: DemoTutorialTrackId;
  completedStepIds: string[];
  isPanelDismissed: boolean;
}

export const DEMO_TUTORIAL_STORAGE_KEY = 'demo_tutorial_state';
export const DEMO_TUTORIAL_ROLE_VIEW_KEY = 'demo_tutorial_resident_view';

export const DEMO_TUTORIAL_TRACKS: DemoTutorialTrack[] = [
  {
    id: 'admin',
    title: 'Board Admin',
    subtitle: 'Run the co-op from operations to governance.',
    startPath: '/',
    startAsResident: false,
    steps: [
      {
        id: 'admin-dashboard',
        title: 'Scan the command dashboard',
        description: 'Start with occupancy, service queue, meetings, and quick actions.',
        route: '/',
        matchRoutes: ['/'],
      },
      {
        id: 'admin-unit-detail',
        title: 'Open a unit record',
        description: 'Review a unit profile, linked resident history, and maintenance context.',
        route: '/admin/units/u1',
        matchRoutes: ['/admin/units/'],
        eventName: 'unit_opened',
      },
      {
        id: 'admin-maintenance',
        title: 'Review maintenance operations',
        description: 'See active work orders and board-side request controls.',
        route: '/maintenance',
        matchRoutes: ['/maintenance'],
        eventName: 'maintenance_opened',
      },
      {
        id: 'admin-minutes',
        title: 'Save a minutes record',
        description: 'Use an event detail page to show how minutes can become archived records.',
        route: '/calendar',
        matchRoutes: ['/calendar/'],
        eventName: 'minutes_saved',
      },
      {
        id: 'admin-documents',
        title: 'Open the document library',
        description: 'Show governance records, Blob-backed archives, and AI-readiness status.',
        route: '/documents',
        matchRoutes: ['/documents'],
        eventName: 'document_opened',
      },
      {
        id: 'admin-policy',
        title: 'Ask the Policy Assistant',
        description: 'Demonstrate how document intelligence answers board policy questions.',
        route: '/policy-assistant',
        matchRoutes: ['/policy-assistant'],
        eventName: 'policy_question_asked',
      },
    ],
  },
  {
    id: 'resident',
    title: 'Resident',
    subtitle: 'Experience the member-facing side of the portal.',
    startPath: '/',
    startAsResident: true,
    steps: [
      {
        id: 'resident-dashboard',
        title: 'Start from the resident dashboard',
        description: 'See the member view with personal service and community shortcuts.',
        route: '/',
        matchRoutes: ['/'],
      },
      {
        id: 'resident-maintenance',
        title: 'Submit or review a service request',
        description: 'Walk through the resident maintenance request experience.',
        route: '/maintenance',
        matchRoutes: ['/maintenance'],
        eventName: 'maintenance_submitted',
      },
      {
        id: 'resident-documents',
        title: 'Read co-op documents',
        description: 'Open the rules, bylaws, or archived governance records.',
        route: '/documents',
        matchRoutes: ['/documents'],
        eventName: 'document_opened',
      },
      {
        id: 'resident-calendar',
        title: 'Check the community calendar',
        description: 'Review upcoming meetings and community events.',
        route: '/calendar',
        matchRoutes: ['/calendar', '/calendar/'],
      },
    ],
  },
  {
    id: 'pitch',
    title: 'Pitch Meeting',
    subtitle: 'A concise product story for pilots, funders, or partners.',
    startPath: '/',
    startAsResident: false,
    steps: [
      {
        id: 'pitch-dashboard',
        title: 'Show the operating snapshot',
        description: 'Use the dashboard to explain how boards get immediate situational awareness.',
        route: '/',
        matchRoutes: ['/'],
      },
      {
        id: 'pitch-documents',
        title: 'Open records and RAG readiness',
        description: 'Show document status, versioned archives, and the path toward grounded AI.',
        route: '/documents',
        matchRoutes: ['/documents'],
        eventName: 'document_opened',
      },
      {
        id: 'pitch-minutes',
        title: 'Archive meeting minutes',
        description: 'Demonstrate the minutes-to-document-library flow.',
        route: '/calendar',
        matchRoutes: ['/calendar/'],
        eventName: 'minutes_saved',
      },
      {
        id: 'pitch-policy',
        title: 'Ask a policy question',
        description: 'Show the assistant as the payoff for organized governance records.',
        route: '/policy-assistant',
        matchRoutes: ['/policy-assistant'],
        eventName: 'policy_question_asked',
      },
      {
        id: 'pitch-role-switch',
        title: 'Switch to resident view',
        description: 'Close by showing that the same platform serves both board and residents.',
        route: '/',
        matchRoutes: ['/'],
        eventName: 'role_switched',
      },
    ],
  },
];

export const getTutorialTrack = (trackId?: string | null) =>
  DEMO_TUTORIAL_TRACKS.find(track => track.id === trackId) || null;

const HIDDEN_TUTORIAL_TRACK_IDS = new Set<DemoTutorialTrackId>(['pitch']);

export const getVisibleTutorialTracks = () =>
  DEMO_TUTORIAL_TRACKS.filter(track => !HIDDEN_TUTORIAL_TRACK_IDS.has(track.id));

export const createInitialTutorialState = (trackId: DemoTutorialTrackId): DemoTutorialState => ({
  trackId,
  completedStepIds: [],
  isPanelDismissed: false,
});

export const getNextIncompleteStep = (state: DemoTutorialState) => {
  const track = getTutorialTrack(state.trackId);
  if (!track) return null;
  return track.steps.find(step => !state.completedStepIds.includes(step.id)) || null;
};

const unique = (values: string[]) => Array.from(new Set(values));

export const markTutorialStepDone = (state: DemoTutorialState, stepId: string): DemoTutorialState => {
  if (state.completedStepIds.includes(stepId)) return state;
  return {
    ...state,
    completedStepIds: [...state.completedStepIds, stepId],
  };
};

const routeMatches = (pathname: string, routePattern: string) =>
  routePattern === '/' ? pathname === '/' : pathname === routePattern || pathname.startsWith(routePattern);

export const updateTutorialProgress = (
  state: DemoTutorialState,
  update: { pathname?: string; eventName?: DemoTutorialEvent },
): DemoTutorialState => {
  const track = getTutorialTrack(state.trackId);
  if (!track) return state;

  const completed = track.steps
    .filter(step => {
      const matchesRoute = update.pathname && step.matchRoutes?.some(route => routeMatches(update.pathname || '', route));
      const matchesEvent = update.eventName && step.eventName === update.eventName;
      return matchesRoute || matchesEvent;
    })
    .map(step => step.id);

  const newlyCompleted = completed.filter(stepId => !state.completedStepIds.includes(stepId));
  if (newlyCompleted.length === 0) return state;

  return {
    ...state,
    completedStepIds: unique([...state.completedStepIds, ...newlyCompleted]),
  };
};

export const resetTutorialState = (state: DemoTutorialState) => createInitialTutorialState(state.trackId);

export const readTutorialState = (): DemoTutorialState | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(DEMO_TUTORIAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DemoTutorialState;
    return getTutorialTrack(parsed.trackId) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveTutorialState = (state: DemoTutorialState) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEMO_TUTORIAL_STORAGE_KEY, JSON.stringify(state));
};

export const clearTutorialState = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEMO_TUTORIAL_STORAGE_KEY);
  localStorage.removeItem(DEMO_TUTORIAL_ROLE_VIEW_KEY);
};

export const skipDemoTutorial = () => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('demo_mode', 'true');
  localStorage.removeItem(DEMO_TUTORIAL_STORAGE_KEY);
  localStorage.setItem(DEMO_TUTORIAL_ROLE_VIEW_KEY, 'false');
};

export const recordTutorialEvent = (eventName: DemoTutorialEvent) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('demo-tutorial-event', { detail: eventName }));
};
