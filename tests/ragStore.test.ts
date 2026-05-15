import assert from 'node:assert/strict';
import { getAskStoreNamesFromResolvedStores, resolveEnvStoreOverrides } from '../services/ragStore.js';

const previousCoop = process.env.GEMINI_FILE_SEARCH_STORE_NAME;
const previousShared = process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME;

try {
  process.env.GEMINI_FILE_SEARCH_STORE_NAME = 'fileSearchStores/coop-test';
  process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME = 'fileSearchStores/province-test';

  const overrides = resolveEnvStoreOverrides('coop-1');
  assert.equal(overrides.coop?.geminiStoreName, 'fileSearchStores/coop-test');
  assert.equal(overrides.shared?.geminiStoreName, 'fileSearchStores/province-test');
  assert.deepEqual(getAskStoreNamesFromResolvedStores(overrides), [
    'fileSearchStores/coop-test',
    'fileSearchStores/province-test',
  ]);
} finally {
  if (previousCoop === undefined) delete process.env.GEMINI_FILE_SEARCH_STORE_NAME;
  else process.env.GEMINI_FILE_SEARCH_STORE_NAME = previousCoop;

  if (previousShared === undefined) delete process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME;
  else process.env.GEMINI_PROVINCE_FILE_SEARCH_STORE_NAME = previousShared;
}

console.log('ragStore tests passed');
