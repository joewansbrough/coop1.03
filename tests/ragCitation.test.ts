import assert from 'node:assert/strict';
import { normalizeGeminiCitations, resolveRagCitationLinks } from '../services/ragCitation.js';

const response = {
  candidates: [{
    groundingMetadata: {
      groundingChunks: [{
        retrievedContext: {
          title: 'Pet Policy.pdf',
          text: 'Members may keep approved pets.',
          uri: 'https://drive.google.com/file/d/example/view',
        },
      }],
      groundingSupports: [{
        segment: { text: 'Pets require approval.' },
        groundingChunkIndices: [0],
      }],
    },
  }],
};

const citations = normalizeGeminiCitations(response);

assert.equal(citations.length, 1);
assert.equal(citations[0].title, 'Pet Policy.pdf');
assert.equal(citations[0].text, 'Members may keep approved pets.');
assert.equal(citations[0].uri, 'https://drive.google.com/file/d/example/view');

const resolved = await resolveRagCitationLinks({
  document: {
    findMany: async ({ where }: any) => {
      assert.deepEqual(where.id.in, ['doc-drive', 'doc-blob']);
      return [
        {
          id: 'doc-drive',
          storageProvider: 'GOOGLE_DRIVE',
          sourceWebUrl: 'https://drive.google.com/file/d/drive-doc/view',
          url: '#',
          sourceExternalId: 'drive-doc',
        },
        {
          id: 'doc-blob',
          storageProvider: 'VERCEL_BLOB',
          sourceWebUrl: null,
          url: 'https://blob.vercel-storage.com/doc.pdf',
          sourceExternalId: null,
        },
      ];
    },
  },
} as any, [
  { title: 'Drive Doc', documentId: 'doc-drive', pageNumber: 3 },
  { title: 'Blob Doc', documentId: 'doc-blob' },
  { title: 'External', uri: 'https://example.com/source.pdf' },
]);

assert.equal(resolved[0].href, 'https://drive.google.com/file/d/drive-doc/view');
assert.equal(resolved[1].href, '/api/documents/doc-blob/original');
assert.equal(resolved[2].href, 'https://example.com/source.pdf');

console.log('ragCitation tests passed');
