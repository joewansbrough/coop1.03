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

const maintenanceTerms = /\b(leak|leaking|sink|toilet|pipe|plumb|broken|repair|maintenance|mold|electrical|heat|hot water|damage|flood|drain)\b/i;

export const detectOracleIntent = (question: string): Pick<OracleResponse, 'intent' | 'suggestedAction'> => {
  if (maintenanceTerms.test(question)) {
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
