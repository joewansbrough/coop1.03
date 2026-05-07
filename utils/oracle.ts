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

const maintenanceTerms = /\b(leak|sink|toilet|mold|electrical|heat|hot water|damage|flood|drain)\b/i;

export const detectOracleIntent = (question: string): Pick<OracleResponse, 'intent' | 'suggestedAction'> => {
  // Check for specific actionable maintenance issues (leaks, etc.) rather than just the word "maintenance"
  if (maintenanceTerms.test(question) && !/\b(committee|chair|meeting|policy|who is)\b/i.test(question)) {
    const suggestedAction: OracleSuggestedAction = {
      type: 'start-maintenance-request',
      label: 'Start maintenance request',
      href: '/maintenance?action=new-request',
    };
    return { intent: 'maintenance', suggestedAction };
  }
  if (/\b(board|committee|meeting|agm|vote|motion|minutes)\b/i.test(question)) return { intent: 'governance' };
  if (/\b(policy|rule|bylaw|agreement|guest|pet|parking|clutter)\b/i.test(question)) return { intent: 'policy' };
  return { intent: 'general' };
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
