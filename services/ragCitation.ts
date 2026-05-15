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
