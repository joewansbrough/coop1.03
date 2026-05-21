import assert from 'node:assert/strict';
import {
  getDocumentOnboardingState,
  getDriveConfigurationMessage,
  getRagFailureMessage,
} from '../utils/documentOnboarding.ts';

const emptyState = getDocumentOnboardingState([]);
assert.equal(emptyState.documentsLoaded, false);
assert.equal(emptyState.driveLinkedDocuments, 0);
assert.equal(emptyState.indexedDocuments, 0);
assert.equal(emptyState.indexableDocuments, 0);
assert.equal(emptyState.primaryTitle, 'Connect documents to unlock Oracle');
assert.equal(emptyState.primaryActionLabel, 'Link Google Drive');
assert.equal(emptyState.secondaryActionLabel, 'Upload document');
assert.equal(emptyState.ragReady, false);

const unindexedDriveState = getDocumentOnboardingState([
  {
    id: 'doc-1',
    title: 'Occupancy Policy',
    category: 'Policy',
    url: 'https://drive.google.com/file/d/abc',
    fileType: 'pdf',
    author: 'Google Drive',
    date: '2026-01-01',
    storageProvider: 'GOOGLE_DRIVE',
    sourceExternalId: 'abc',
    currentVersion: {
      id: 'version-1',
      version: 1,
      source: 'drive',
      storageUrl: 'https://drive.google.com/file/d/abc',
      ingestionStatus: 'ready',
      ragStatus: 'not_indexed',
    },
  },
]);
assert.equal(unindexedDriveState.documentsLoaded, true);
assert.equal(unindexedDriveState.driveLinkedDocuments, 1);
assert.equal(unindexedDriveState.indexableDocuments, 1);
assert.equal(unindexedDriveState.indexedDocuments, 0);
assert.equal(unindexedDriveState.primaryTitle, 'Index documents for Oracle');
assert.equal(unindexedDriveState.primaryActionLabel, 'Index Drive documents');

const indexedState = getDocumentOnboardingState([
  {
    id: 'doc-2',
    title: 'Rules',
    category: 'Policy',
    url: 'https://drive.google.com/file/d/def',
    fileType: 'pdf',
    author: 'Google Drive',
    date: '2026-01-01',
    storageProvider: 'GOOGLE_DRIVE',
    sourceExternalId: 'def',
    currentVersion: {
      id: 'version-2',
      version: 1,
      source: 'drive',
      storageUrl: 'https://drive.google.com/file/d/def',
      ingestionStatus: 'ready',
      ragStatus: 'indexed',
    },
  },
]);
assert.equal(indexedState.ragReady, true);
assert.equal(indexedState.primaryTitle, 'Document intelligence is ready');
assert.equal(indexedState.primaryActionLabel, 'Ask Oracle');

assert.equal(
  getDriveConfigurationMessage({ googleClientId: '', googleApiKey: 'key' }),
  'Google Drive linking needs a browser client ID and API key before admins can choose files.',
);
assert.equal(getDriveConfigurationMessage({ googleClientId: 'client', googleApiKey: 'key' }), null);

assert.equal(
  getRagFailureMessage('Gemini API_KEY is missing.'),
  'Gemini is not configured yet, so Oracle cannot index or search co-op documents.',
);
assert.equal(
  getRagFailureMessage('Only Drive-backed documents can be indexed in this slice'),
  'This document needs to be linked from Google Drive before File Search indexing can run.',
);

console.log('documentOnboarding tests passed');
