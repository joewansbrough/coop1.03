import type { RagCitation } from './ragTypes.js';

const asArray = <T>(value: T[] | undefined | null): T[] => Array.isArray(value) ? value : [];

const metadataValue = (metadata: any[] | undefined, key: string) => {
  const item = asArray(metadata).find((entry: any) => entry?.key === key);
  return item?.stringValue || item?.numericValue || null;
};

export const normalizeGeminiCitations = (response: any): RagCitation[] => {
  const chunks = asArray(response?.candidates?.[0]?.groundingMetadata?.groundingChunks);
  const seen = new Set<string>();

  return chunks
    .map((chunk: any): RagCitation | null => {
      const context = chunk?.retrievedContext || chunk?.web || chunk;
      const metadata = context?.customMetadata || chunk?.customMetadata;
      const title = String(context?.title || metadataValue(metadata, 'title') || 'Source document');
      const text = context?.text ? String(context.text) : undefined;
      const uri = context?.uri ? String(context.uri) : undefined;
      const pageRaw = metadataValue(metadata, 'pageNumber');
      const pageNumber = typeof pageRaw === 'number' ? pageRaw : pageRaw ? Number(pageRaw) : null;
      const documentId = metadataValue(metadata, 'documentId');
      const documentVersionId = metadataValue(metadata, 'documentVersionId');
      const scope = metadataValue(metadata, 'scope');
      const sourceSystem = metadataValue(metadata, 'sourceSystem');
      const key = `${title}|${uri || ''}|${documentId || ''}|${text || ''}`;

      if (seen.has(key)) return null;
      seen.add(key);

      return {
        title,
        text,
        uri,
        pageNumber: Number.isFinite(pageNumber) ? pageNumber : null,
        documentId: documentId ? String(documentId) : null,
        documentVersionId: documentVersionId ? String(documentVersionId) : null,
        scope: scope ? String(scope) : null,
        sourceSystem: sourceSystem ? String(sourceSystem) : null,
      };
    })
    .filter((citation): citation is RagCitation => Boolean(citation));
};

const getDriveUrl = (document: any) => {
  if (document?.sourceWebUrl) return document.sourceWebUrl;
  if (document?.url && document.url !== '#') return document.url;
  if (document?.sourceExternalId) return `https://drive.google.com/open?id=${encodeURIComponent(document.sourceExternalId)}`;
  return null;
};

const getDocumentHref = (document: any) => {
  if (!document?.id) return null;
  if (document.storageProvider === 'GOOGLE_DRIVE' || document.sourceExternalId) {
    return getDriveUrl(document);
  }
  return `/api/documents/${encodeURIComponent(document.id)}/original`;
};

const hasSectionDeeplink = (citation: RagCitation) => {
  const target = citation.href || citation.uri || '';
  if (!target) return false;

  try {
    const url = new URL(target, 'https://coophub.local');
    if (url.hash) return true;
    if (url.searchParams.has('page')) return true;
    if (url.searchParams.has('section')) return true;
    if (url.searchParams.has('chunk')) return true;
    if (url.searchParams.has('text')) return true;
    return false;
  } catch {
    return /#|[?&](page|section|chunk|text)=/.test(target);
  }
};

const getCitationDocumentKey = (citation: RagCitation) => {
  if (citation.documentId) return `document:${citation.documentId}`;
  if (citation.href) return `href:${citation.href}`;
  if (citation.uri) return `uri:${citation.uri}`;
  return `title:${citation.title}`;
};

export const dedupeRagCitationsForDisplay = (citations: RagCitation[]): RagCitation[] => {
  const seenDocumentLinks = new Set<string>();

  return citations.filter(citation => {
    if (hasSectionDeeplink(citation)) return true;

    const key = getCitationDocumentKey(citation);
    if (seenDocumentLinks.has(key)) return false;
    seenDocumentLinks.add(key);
    return true;
  });
};

export const resolveRagCitationLinks = async (prisma: any, citations: RagCitation[]): Promise<RagCitation[]> => {
  const documentIds = Array.from(new Set(citations.map(citation => citation.documentId).filter(Boolean))) as string[];
  if (!documentIds.length) {
    return dedupeRagCitationsForDisplay(citations.map(citation => ({ ...citation, href: citation.uri })));
  }

  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    select: {
      id: true,
      url: true,
      storageProvider: true,
      sourceExternalId: true,
      sourceWebUrl: true,
    },
  });
  const byId = new Map(documents.map((document: any) => [document.id, document]));

  return dedupeRagCitationsForDisplay(citations.map(citation => {
    const document = citation.documentId ? byId.get(citation.documentId) : null;
    return {
      ...citation,
      href: document ? getDocumentHref(document) || citation.uri : citation.uri,
    };
  }));
};
