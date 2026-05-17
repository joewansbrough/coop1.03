export const RAG_STORE_SCOPES = {
  COOP_DOCUMENTS: 'coop_documents',
  PROVINCE_COMMON: 'province_common',
} as const;

export type RagStoreScope = typeof RAG_STORE_SCOPES[keyof typeof RAG_STORE_SCOPES];

export const RAG_STATUSES = {
  NOT_INDEXED: 'not_indexed',
  INDEXING: 'indexing',
  INDEXED: 'indexed',
  FAILED: 'failed',
  STALE: 'stale',
  DELETED: 'deleted',
} as const;

export type RagStatus = typeof RAG_STATUSES[keyof typeof RAG_STATUSES];

export type RagCitation = {
  title: string;
  text?: string;
  uri?: string;
  href?: string;
  pageNumber?: number | null;
  documentId?: string | null;
  documentVersionId?: string | null;
  scope?: string | null;
  sourceSystem?: string | null;
};
