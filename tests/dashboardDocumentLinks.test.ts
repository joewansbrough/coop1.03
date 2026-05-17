import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDocumentLibraryDestination,
  getDashboardDocumentLink,
  getDocumentLibraryOriginalUrl,
} from '../utils/dashboardDocumentLinks.ts';

const minutesDocument = {
  id: 'doc-1',
  title: 'Board Meeting Minutes - April 2026',
  category: 'Minutes',
  url: 'https://example.com/minutes.pdf',
  fileType: 'pdf',
  author: 'Secretary',
  date: '2026-04-28',
  tags: ['minutes', 'minutes-meeting:e5'],
};

test('links minutes documents to the meeting minutes page before the file URL', () => {
  assert.deepEqual(getDashboardDocumentLink(minutesDocument), {
    type: 'route',
    href: '/calendar/e5?tab=minutes',
  });
});

test('documents page sends tenant minutes clicks to the meeting minutes tab', () => {
  assert.deepEqual(getDocumentLibraryDestination(minutesDocument, { isAdmin: false }), {
    type: 'route',
    href: '/calendar/e5?tab=minutes',
  });
});

test('documents page keeps admin document clicks in the review portal', () => {
  assert.deepEqual(getDocumentLibraryDestination(minutesDocument, { isAdmin: true }), {
    type: 'review',
  });
});

test('links ordinary documents directly to their file URL', () => {
  assert.deepEqual(getDashboardDocumentLink({
    ...minutesDocument,
    id: 'doc-2',
    title: 'Pet Policy',
    category: 'Policy',
    tags: ['policy'],
  }), {
    type: 'external',
    href: 'https://example.com/minutes.pdf',
  });
});

test('falls back to the document library when no direct destination exists', () => {
  assert.deepEqual(getDashboardDocumentLink({
    ...minutesDocument,
    url: '#',
    tags: [],
  }), {
    type: 'route',
    href: '/documents',
  });
});

test('routes blob-backed documents through the authenticated original file endpoint', () => {
  assert.equal(getDocumentLibraryOriginalUrl({
    ...minutesDocument,
    id: 'doc-blob',
    url: '#',
    currentVersion: {
      id: 'version-1',
      version: 1,
      source: 'generated-minutes',
      storageUrl: 'https://blob.example/minutes.pdf',
      ingestionStatus: 'ready',
    },
  }), '/api/documents/doc-blob/original');
});

test('links ordinary blob-backed documents through the authenticated original endpoint', () => {
  assert.deepEqual(getDashboardDocumentLink({
    ...minutesDocument,
    id: 'doc-policy-blob',
    title: 'Pet Policy',
    category: 'Policy',
    tags: ['policy'],
    url: '#',
    currentVersion: {
      id: 'version-2',
      version: 2,
      source: 'upload',
      storageUrl: 'https://blob.example/pet-policy.pdf',
      ingestionStatus: 'ready',
    },
  }), {
    type: 'external',
    href: '/api/documents/doc-policy-blob/original',
  });
});

test('opens Google Drive documents with their stored Drive web link', () => {
  const driveDocument = {
    ...minutesDocument,
    id: 'doc-drive',
    title: 'Shared Drive Policy',
    category: 'Policy',
    tags: ['policy'],
    url: '#',
    storageProvider: 'GOOGLE_DRIVE' as const,
    sourceExternalId: 'drive-file-123',
    sourceWebUrl: 'https://drive.google.com/file/d/drive-file-123/view',
    currentVersion: {
      id: 'version-drive',
      version: 1,
      source: 'google-drive',
      storageUrl: 'https://drive.google.com/file/d/drive-file-123/view',
      ingestionStatus: 'ready',
    },
  };

  assert.equal(
    getDocumentLibraryOriginalUrl(driveDocument),
    'https://drive.google.com/file/d/drive-file-123/view',
  );
  assert.deepEqual(getDocumentLibraryDestination(driveDocument, { isAdmin: true }), {
    type: 'external',
    href: 'https://drive.google.com/file/d/drive-file-123/view',
  });
  assert.deepEqual(getDashboardDocumentLink(driveDocument), {
    type: 'external',
    href: 'https://drive.google.com/file/d/drive-file-123/view',
  });
});
