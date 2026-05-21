import type { Document } from '../types';

type DriveConfig = {
  googleClientId?: string | null;
  googleApiKey?: string | null;
};

export type DocumentOnboardingState = {
  documentsLoaded: boolean;
  totalDocuments: number;
  driveLinkedDocuments: number;
  indexableDocuments: number;
  indexedDocuments: number;
  failedIndexDocuments: number;
  ragReady: boolean;
  primaryTitle: string;
  primaryDescription: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
};

const hasDriveFileId = (document: Document) =>
  Boolean(document.sourceExternalId) ||
  Boolean((document.currentVersion as any)?.sourceExternalId);

const isDriveBacked = (document: Document) =>
  document.storageProvider === 'GOOGLE_DRIVE' ||
  Boolean(document.url?.includes('drive.google.com')) ||
  hasDriveFileId(document);

const ragStatus = (document: Document) => document.currentVersion?.ragStatus || 'not_indexed';

export const getDocumentOnboardingState = (documents: ReadonlyArray<Document>): DocumentOnboardingState => {
  const totalDocuments = documents.length;
  const driveLinkedDocuments = documents.filter(isDriveBacked).length;
  const indexableDocuments = documents.filter(document => hasDriveFileId(document) && ragStatus(document) !== 'indexed').length;
  const indexedDocuments = documents.filter(document => ragStatus(document) === 'indexed').length;
  const failedIndexDocuments = documents.filter(document => ragStatus(document) === 'failed').length;

  if (totalDocuments === 0) {
    return {
      documentsLoaded: false,
      totalDocuments,
      driveLinkedDocuments,
      indexableDocuments,
      indexedDocuments,
      failedIndexDocuments,
      ragReady: false,
      primaryTitle: 'Connect documents to unlock Oracle',
      primaryDescription: 'Link a shared Google Drive file or upload the first policy, bylaw, minutes, or finance document. Oracle can explain more once real documents are loaded.',
      primaryActionLabel: 'Link Google Drive',
      secondaryActionLabel: 'Upload document',
    };
  }

  if (indexedDocuments === 0 && indexableDocuments > 0) {
    return {
      documentsLoaded: true,
      totalDocuments,
      driveLinkedDocuments,
      indexableDocuments,
      indexedDocuments,
      failedIndexDocuments,
      ragReady: false,
      primaryTitle: 'Index documents for Oracle',
      primaryDescription: 'Drive-backed documents are linked. Index them with Gemini File Search so Oracle can answer from source material with citations.',
      primaryActionLabel: 'Index Drive documents',
      secondaryActionLabel: 'Link more documents',
    };
  }

  if (indexedDocuments > 0) {
    return {
      documentsLoaded: true,
      totalDocuments,
      driveLinkedDocuments,
      indexableDocuments,
      indexedDocuments,
      failedIndexDocuments,
      ragReady: true,
      primaryTitle: 'Document intelligence is ready',
      primaryDescription: 'Oracle has indexed source material available. Keep linking and indexing new records as onboarding continues.',
      primaryActionLabel: 'Ask Oracle',
      secondaryActionLabel: 'Add documents',
    };
  }

  return {
    documentsLoaded: true,
    totalDocuments,
    driveLinkedDocuments,
    indexableDocuments,
    indexedDocuments,
    failedIndexDocuments,
    ragReady: false,
    primaryTitle: 'Add Drive-backed documents for File Search',
    primaryDescription: 'Documents are loaded, but File Search indexing currently works best from Google Drive-backed records.',
    primaryActionLabel: 'Link Google Drive',
    secondaryActionLabel: 'Upload document',
  };
};

export const getDriveConfigurationMessage = (config: DriveConfig | null) => {
  if (!config?.googleClientId || !config?.googleApiKey) {
    return 'Google Drive linking needs a browser client ID and API key before admins can choose files.';
  }
  return null;
};

export const getRagFailureMessage = (message?: string | null) => {
  const value = String(message || '').toLowerCase();
  if (value.includes('api_key') || value.includes('gemini') || value.includes('file search')) {
    return 'Gemini is not configured yet, so Oracle cannot index or search co-op documents.';
  }
  if (value.includes('drive-backed') || value.includes('google drive file id')) {
    return 'This document needs to be linked from Google Drive before File Search indexing can run.';
  }
  return message || 'File Search is not ready for this document yet.';
};
