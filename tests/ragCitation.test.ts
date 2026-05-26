import assert from 'node:assert/strict';
import { normalizeGeminiCitations, resolveRagCitationLinks, dedupeRagCitationsForDisplay } from '../services/ragCitation.js';

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

const displayCitations = dedupeRagCitationsForDisplay([
  { title: 'Pet Policy', documentId: 'doc-pet', href: '/api/documents/doc-pet/original', text: 'First matching chunk.' },
  { title: 'Pet Policy', documentId: 'doc-pet', href: '/api/documents/doc-pet/original', text: 'Second matching chunk.' },
  { title: 'Pet Policy', documentId: 'doc-pet', href: '/api/documents/doc-pet/original?page=4', pageNumber: 4 },
  { title: 'Pet Policy', documentId: 'doc-pet', href: '/api/documents/doc-pet/original?page=7', pageNumber: 7 },
]);

assert.equal(displayCitations.length, 3);
assert.equal(displayCitations[0].text, 'First matching chunk.');
assert.equal(displayCitations[1].pageNumber, 4);
assert.equal(displayCitations[2].pageNumber, 7);

console.log('ragCitation tests passed');
