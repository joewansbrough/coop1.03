import type { OracleLanguage, OracleResponse, OracleSuggestedAction } from '../types';

export const ORACLE_LANGUAGES: OracleLanguage[] = [
  'English',
  'Spanish',
  'French',
  'Cantonese',
  'Mandarin',
  'Punjabi',
  'Tagalog',
];

export const normalizeOracleLanguage = (language?: string | null): OracleLanguage => {
  const normalized = ORACLE_LANGUAGES.find(item => item.toLowerCase() === String(language || '').toLowerCase());
  return normalized || 'English';
};

const maintenanceTerms = /\b(leak|leaking|drip|sink|toilet|mold|electrical|outlet|heat|heating|hot water|damage|flood|flooding|drain|clog|clogged|broken|repair|water|plumbing)\b/i;

export const createMaintenanceRequestHref = (question: string) => {
  const issue = String(question || '').trim().replace(/\s+/g, ' ').slice(0, 600);
  const params = new URLSearchParams({ action: 'new-request' });
  if (issue) params.set('issue', issue);
  return `/maintenance?${params.toString()}`;
};

export const createMaintenanceSuggestedAction = (question: string, label = 'Yes, help me submit a request'): OracleSuggestedAction => ({
  type: 'start-maintenance-request',
  label,
  href: createMaintenanceRequestHref(question),
});

export const mergeOracleSuggestedAction = (
  question: string,
  suggestedAction?: Partial<OracleSuggestedAction> | null,
): OracleSuggestedAction | undefined => {
  const detected = detectOracleIntent(question);
  if (detected.intent !== 'maintenance') {
    return suggestedAction?.type === 'start-maintenance-request'
      ? createMaintenanceSuggestedAction(question, suggestedAction.label || 'Start maintenance request')
      : suggestedAction as OracleSuggestedAction | undefined;
  }

  return createMaintenanceSuggestedAction(
    question,
    suggestedAction?.type === 'start-maintenance-request' && suggestedAction.label
      ? suggestedAction.label
      : 'Yes, help me submit a request',
  );
};

export const detectOracleIntent = (question: string): Pick<OracleResponse, 'intent' | 'suggestedAction'> => {
  // Check for specific actionable maintenance issues (leaks, etc.) rather than just the word "maintenance"
  if (maintenanceTerms.test(question) && !/\b(committee|chair|meeting|who is)\b/i.test(question)) {
    return { intent: 'maintenance', suggestedAction: createMaintenanceSuggestedAction(question) };
  }
  if (/\b(board|committee|meeting|agm|vote|motion|minutes)\b/i.test(question)) return { intent: 'governance' };
  if (/\b(policy|rule|bylaw|agreement|guest|pet|parking|clutter)\b/i.test(question)) return { intent: 'policy' };
  return { intent: 'general' };
};

const docsQuestionTerms = /\b(policy|policies|rule|rules|bylaw|bylaws|agreement|handbook|manual|document|documents|docs|minutes|motion|motions|parking|pet|pets|guest|guests|occupancy|clutter|summarize|summary|what does|what do the)\b/i;
const liveRecordTerms = /\b(who lives|unit\s+\w+|open maintenance|maintenance requests?|work orders?|tenant|tenants|resident|residents|waitlist|notifications?)\b/i;

export const shouldAnswerOracleWithDocs = (question: string) => {
  const normalized = String(question || '').trim();
  if (!normalized) return false;
  if (liveRecordTerms.test(normalized)) return false;
  return docsQuestionTerms.test(normalized);
};

export const createOracleFallbackResponse = (question: string, language?: string): OracleResponse => ({
  answer: 'I could not reach the AI service, but your question has been saved for review. Please verify urgent or legal matters with the board.',
  citations: [],
  language: normalizeOracleLanguage(language),
  confidence: 0,
  ...detectOracleIntent(question),
});

export const createDemoOracleResponse = (question: string, language?: string): OracleResponse => {
  const intent = detectOracleIntent(question);
  const normalizedLanguage = normalizeOracleLanguage(language);
  const questionLower = question.toLowerCase();

  let answer = 'In demo mode, I can give a general co-op guidance answer based on the sample policy set. For a binding answer, check the current bylaws, occupancy agreement, or board notice.';
  const citations = [{ title: 'Demo Co-op Policy Guide' }];

  if (intent.intent === 'maintenance') {
    answer = 'For a maintenance issue, submit a maintenance request so the co-op has a formal record. If there is active leaking, electrical risk, flooding, no heat, or an immediate safety concern, contact the emergency maintenance contact right away while you file the request.';
  } else if (questionLower.includes('pet')) {
    answer = 'Demo policy answer: pets usually need to be registered with the co-op, kept under control in common areas, and managed so they do not create noise, cleanliness, or safety issues for neighbours.';
  } else if (questionLower.includes('guest')) {
    answer = 'Demo policy answer: short guest stays are generally allowed, but longer stays should be reported to the board or membership committee so occupancy records remain accurate.';
  } else if (questionLower.includes('hallway') || questionLower.includes('clutter')) {
    answer = 'Demo policy answer: hallways and shared exits should be kept clear for fire safety, accessibility, and emergency access. Personal items should stay inside the unit or in approved storage areas.';
  } else if (questionLower.includes('committee')) {
    answer = 'Demo governance answer: members can usually join a committee by contacting the committee chair or board, attending a meeting, and being added to the committee roster.';
  } else if (intent.intent === 'governance') {
    answer = 'Demo governance answer: board and committee decisions should be recorded in minutes, with motions, decisions, and action items kept clear enough for members to review later.';
  }

  if (normalizedLanguage !== 'English') {
    answer = `[Demo ${normalizedLanguage}] ${answer}`;
  }

  return {
    answer,
    citations,
    language: normalizedLanguage,
    confidence: 0.72,
    ...intent,
  };
};
