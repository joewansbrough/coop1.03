import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ensureDashboardPreferenceSchema,
  ensureDocumentRagSchema,
  resetSchemaRepairCacheForTests,
} from '../services/schemaRepair.ts';

const createPrisma = () => {
  const queries: string[] = [];
  return {
    queries,
    $executeRawUnsafe: async (query: string) => {
      queries.push(query);
      return 0;
    },
  } as any;
};

test('document RAG schema repair adds missing rag status columns before Prisma document version writes', async () => {
  resetSchemaRepairCacheForTests();
  const prisma = createPrisma();

  await ensureDocumentRagSchema(prisma);

  assert.equal(prisma.queries.some(query => query.includes('CREATE TABLE IF NOT EXISTS "DocumentVersion"')), true);
  assert.equal(prisma.queries.some(query => query.includes('ADD COLUMN IF NOT EXISTS "ragStatus"')), true);
  assert.equal(prisma.queries.some(query => query.includes('CREATE TABLE IF NOT EXISTS "DocumentIngestionJob"')), true);
});

test('dashboard schema repair provisions dashboard preferences table', async () => {
  resetSchemaRepairCacheForTests();
  const prisma = createPrisma();

  await ensureDashboardPreferenceSchema(prisma);

  assert.equal(prisma.queries.some(query => query.includes('CREATE TABLE IF NOT EXISTS "DashboardPreference"')), true);
  assert.equal(prisma.queries.some(query => query.includes('DashboardPreference_cooperativeId_userEmail_key')), true);
});
