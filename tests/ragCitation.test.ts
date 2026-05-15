import assert from 'node:assert/strict';
import { normalizeGeminiCitations } from '../services/ragCitation.js';

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

console.log('ragCitation tests passed');
