import type { RagCitation } from '../types';

export type RagAskSessionStatus = 'idle' | 'pending' | 'answered' | 'error';

export type RagAskSession = {
  id: string;
  status: RagAskSessionStatus;
  question: string;
  answer: string;
  citations: RagCitation[];
  storeNames: string[];
  error: string;
  updatedAt: number;
};

const makeSessionId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeCitations = (value: unknown): RagCitation[] =>
  Array.isArray(value) ? value.filter((item): item is RagCitation => Boolean(item && typeof item === 'object')) : [];

const normalizeStoreNames = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const createPendingRagAskSession = (question: string): RagAskSession => ({
  id: makeSessionId(),
  status: 'pending',
  question: question.trim(),
  answer: '',
  citations: [],
  storeNames: [],
  error: '',
  updatedAt: Date.now(),
});

export const createResolvedRagAskSession = (
  previous: RagAskSession,
  data: { answer?: unknown; citations?: unknown; storeNames?: unknown },
): RagAskSession => ({
  ...previous,
  status: 'answered',
  answer: typeof data.answer === 'string' && data.answer.trim()
    ? data.answer
    : 'I could not find this in the indexed documents.',
  citations: normalizeCitations(data.citations),
  storeNames: normalizeStoreNames(data.storeNames),
  error: '',
  updatedAt: Date.now(),
});

export const createErroredRagAskSession = (previous: RagAskSession, error: unknown): RagAskSession => ({
  ...previous,
  status: 'error',
  error: error instanceof Error ? error.message : String(error || 'Failed to ask indexed documents.'),
  updatedAt: Date.now(),
});

export const parseRagAskSession = (value: string | null): RagAskSession | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!['idle', 'pending', 'answered', 'error'].includes(parsed.status)) return null;
    if (typeof parsed.question !== 'string') return null;
    return {
      id: typeof parsed.id === 'string' ? parsed.id : makeSessionId(),
      status: parsed.status,
      question: parsed.question,
      answer: typeof parsed.answer === 'string' ? parsed.answer : '',
      citations: normalizeCitations(parsed.citations),
      storeNames: normalizeStoreNames(parsed.storeNames),
      error: typeof parsed.error === 'string' ? parsed.error : '',
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
};
