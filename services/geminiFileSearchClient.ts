import { GoogleGenAI } from '@google/genai';

export const getGeminiApiKey = () => process.env.GEMINI_API_KEY || process.env.API_KEY || '';

export const getGeminiRagModel = () => process.env.GEMINI_RAG_MODEL || 'gemini-3.1-flash-lite';

export const getGeminiEmbeddingModel = () =>
  process.env.GEMINI_RAG_EMBEDDING_MODEL || 'models/gemini-embedding-2';

export const createGeminiFileSearchClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY or API_KEY for Gemini File Search');
  }
  return new GoogleGenAI({ apiKey });
};
