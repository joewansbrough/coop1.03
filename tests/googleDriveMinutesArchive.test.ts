import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGoogleDriveMinutesArchiveInput,
  decodePdfDataUrl,
} from '../utils/googleDriveMinutesArchive.ts';

const pdfDataUrl = `data:application/pdf;base64,${Buffer.from('%PDF drive test').toString('base64')}`;

test('decodes PDF data URLs for Google Drive upload', () => {
  assert.equal(decodePdfDataUrl(pdfDataUrl).toString('utf8'), '%PDF drive test');
});

test('rejects non-PDF data URLs before upload', () => {
  assert.throws(() => decodePdfDataUrl('data:text/plain;base64,abc'), /PDF data URL/);
});

test('builds Google Drive archive metadata for minutes', () => {
  const input = buildGoogleDriveMinutesArchiveInput({
    meetingId: 'meeting-1',
    cooperativeId: 'coop-1',
    eventTitle: 'April Board Meeting',
    committeeName: 'Board',
    title: 'April Board Minutes',
    date: '2026-04-15T00:00:00.000Z',
    folderId: 'drive-folder-1',
    pdfDataUrl,
  });

  assert.equal(input.fileName, 'April-Board-Minutes.pdf');
  assert.equal(input.folderId, 'drive-folder-1');
  assert.equal(input.documentTitle, 'April Board Minutes');
  assert.equal(input.documentDate.toISOString(), '2026-04-15T00:00:00.000Z');
  assert.deepEqual(input.tags, ['2026', 'Minutes', 'Meeting Minutes', 'Board', 'minutes-meeting:meeting-1']);
  assert.equal(input.pdfBytes.toString('utf8'), '%PDF drive test');
});
