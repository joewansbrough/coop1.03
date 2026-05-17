import type { PrismaClient } from '@prisma/client';
import { createGeminiFileSearchClient, getGeminiRagModel } from './geminiFileSearchClient.js';
import { normalizeGeminiCitations } from './ragCitation.js';
import { getAskRagStores, getAskStoreNamesFromResolvedStores } from './ragStore.js';

const SYSTEM_INSTRUCTION = [
  'You are coopHUB Docs, an admin-only document question answering assistant.',
  'Answer only from retrieved coopHUB co-op documents and shared BC co-op reference documents.',
  'If the answer is not in the retrieved documents, say you could not find it in the indexed documents.',
  'Do not invent policy, fees, dates, legal requirements, or board decisions.',
  'Keep answers concise and cite source documents when grounding metadata is available.',
].join('\n');

export const RAG_GENERATE_TIMEOUT_MS = 45_000;

export const validateRagQuestion = (value: unknown): string => {
  const question = String(value || '').trim();
  if (!question) throw new Error('Question is required');
  if (question.length < 2) throw new Error('Question must be at least 2 characters');
  if (question.length > 2000) throw new Error('Question is too long');
  return question;
};

const getGeminiResponseText = (response: any): string => {
  if (typeof response?.text === 'string') return response.text.trim();

  if (typeof response?.text === 'function') {
    try {
      const text = response.text();
      if (typeof text === 'string' && text.trim()) return text.trim();
    } catch {
      // Fall through to candidate parts for SDK response shapes where text() is unavailable at runtime.
    }
  }

  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  const candidateParts = candidates
    .flatMap((candidate: any) => Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [])
    .map((part: any) => typeof part?.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n')
    .trim();

  return candidateParts || '';
};

export const buildRagGenerateContentConfig = (storeNames: string[], abortSignal?: AbortSignal) => ({
  systemInstruction: SYSTEM_INSTRUCTION,
  httpOptions: {
    timeout: RAG_GENERATE_TIMEOUT_MS,
  },
  abortSignal,
  tools: [{
    fileSearch: {
      fileSearchStoreNames: storeNames,
    },
  }],
});

export const askGeminiFileSearch = async (
  prisma: PrismaClient,
  input: { cooperativeId: string; question: string },
) => {
  const question = validateRagQuestion(input.question);
  const stores = await getAskRagStores(prisma, input.cooperativeId);
  const storeNames = getAskStoreNamesFromResolvedStores(stores);
  if (!storeNames.length) throw new Error('No Gemini File Search stores are configured');

  const ai = createGeminiFileSearchClient();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), RAG_GENERATE_TIMEOUT_MS);
  const response = await ai.models.generateContent({
    model: getGeminiRagModel(),
    contents: [{
      role: 'user',
      parts: [{ text: question }],
    }],
    config: buildRagGenerateContentConfig(storeNames, abortController.signal),
  } as any).finally(() => clearTimeout(timeout));

  return {
    answer: getGeminiResponseText(response) || 'I could not find this in the indexed documents.',
    citations: normalizeGeminiCitations(response),
    storeNames,
  };
};
