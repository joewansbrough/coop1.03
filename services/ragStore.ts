import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { createGeminiFileSearchClient, getGeminiEmbeddingModel } from './geminiFileSearchClient.js';
import { RAG_STORE_SCOPES } from './ragTypes.js';

type ResolvedStore = {
  scope: string;
  cooperativeId: string | null;
  displayName: string;
  geminiStoreName: string;
  embeddingModel: string;
};

const isUniqueConstraintError = (error: unknown) => {
  const value = error as { code?: unknown; message?: unknown; meta?: { code?: unknown } };
  const message = typeof value?.message === 'string' ? value.message.toLowerCase() : '';
  return (
    value?.code === 'P2002' ||
    value?.code === '23505' ||
    value?.meta?.code === '23505' ||
    message.includes('unique constraint') ||
    message.includes('duplicate key')
  );
};

const recoverFromConcurrentCreate = async (
  error: unknown,
  findExisting: () => Promise<ResolvedStore | null>,
): Promise<ResolvedStore> => {
  if (!isUniqueConstraintError(error)) throw error;

  const existing = await findExisting();
  if (existing) return existing;

  throw error;
};

export const resolveEnvStoreOverrides = (cooperativeId: string): { coop?: ResolvedStore; shared?: ResolvedStore } => {
  const embeddingModel = getGeminiEmbeddingModel();
  return {
    coop: process.env.GEMINI_FILE_SEARCH_STORE_NAME ? {
      cooperativeId,
      scope: RAG_STORE_SCOPES.COOP_DOCUMENTS,
      displayName: 'coopHUB co-op documents',
      geminiStoreName: process.env.GEMINI_FILE_SEARCH_STORE_NAME,
      embeddingModel,
    } : undefined,
    shared: process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME ? {
      cooperativeId: null,
      scope: RAG_STORE_SCOPES.PROVINCE_COMMON,
      displayName: 'coopHUB BC co-op references',
      geminiStoreName: process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME,
      embeddingModel,
    } : undefined,
  };
};

export const getAskStoreNamesFromResolvedStores = (stores: { coop?: ResolvedStore; shared?: ResolvedStore }) =>
  [stores.coop?.geminiStoreName, stores.shared?.geminiStoreName].filter((name): name is string => Boolean(name));

const createGeminiStore = async (displayName: string) => {
  const ai = createGeminiFileSearchClient();
  const store = await ai.fileSearchStores.create({
    config: {
      displayName,
      embeddingModel: getGeminiEmbeddingModel(),
    },
  });
  if (!store.name) throw new Error('Gemini did not return a File Search store name');
  return store.name;
};

const createSharedProvinceStoreRow = async (
  prisma: PrismaClient,
  data: { displayName: string; geminiStoreName: string; embeddingModel: string },
): Promise<ResolvedStore> => {
  const rows = await (prisma as any).$queryRaw(Prisma.sql`
    INSERT INTO "RagStore" (
      "id",
      "cooperativeId",
      "scope",
      "displayName",
      "geminiStoreName",
      "embeddingModel",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      NULL,
      ${RAG_STORE_SCOPES.PROVINCE_COMMON},
      ${data.displayName},
      ${data.geminiStoreName},
      ${data.embeddingModel},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING
      "scope",
      "cooperativeId",
      "displayName",
      "geminiStoreName",
      "embeddingModel"
  `) as ResolvedStore[];

  const created = rows[0];
  if (!created) throw new Error('Failed to create shared province RAG store row');
  return created;
};

export const getOrCreateCoopRagStore = async (prisma: PrismaClient, cooperativeId: string): Promise<ResolvedStore> => {
  const env = resolveEnvStoreOverrides(cooperativeId).coop;
  if (env) return env;

  const findExisting = () => (prisma as any).ragStore.findFirst({
    where: { cooperativeId, scope: RAG_STORE_SCOPES.COOP_DOCUMENTS },
  });
  const existing = await findExisting();
  if (existing) return existing;

  const displayName = `coopHUB-${cooperativeId}-documents`;
  const geminiStoreName = await createGeminiStore(displayName);

  try {
    return await (prisma as any).ragStore.create({
      data: {
        cooperativeId,
        scope: RAG_STORE_SCOPES.COOP_DOCUMENTS,
        displayName,
        geminiStoreName,
        embeddingModel: getGeminiEmbeddingModel(),
      },
    });
  } catch (error) {
    return recoverFromConcurrentCreate(error, findExisting);
  }
};

export const getOrCreateSharedProvinceRagStore = async (prisma: PrismaClient): Promise<ResolvedStore> => {
  const env = resolveEnvStoreOverrides('shared').shared;
  if (env) return env;

  const findExisting = () => (prisma as any).ragStore.findFirst({
    where: { cooperativeId: null, scope: RAG_STORE_SCOPES.PROVINCE_COMMON },
  });
  const existing = await findExisting();
  if (existing) return existing;

  const displayName = 'coopHUB BC co-op references';
  const geminiStoreName = await createGeminiStore(displayName);
  const embeddingModel = getGeminiEmbeddingModel();

  try {
    return await createSharedProvinceStoreRow(prisma, { displayName, geminiStoreName, embeddingModel });
  } catch (error) {
    return recoverFromConcurrentCreate(error, findExisting);
  }
};

export const getAskRagStores = async (prisma: PrismaClient, cooperativeId: string) => {
  const [coop, shared] = await Promise.all([
    getOrCreateCoopRagStore(prisma, cooperativeId),
    getOrCreateSharedProvinceRagStore(prisma),
  ]);
  return { coop, shared };
};
