export const parseGeminiJson = <T>(text: string | null | undefined, fallback: T): T => {
  const raw = String(text || '').trim();
  if (!raw) return fallback;

  const candidates = [
    raw,
    raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(),
    raw.match(/\{[\s\S]*\}/)?.[0],
    raw.match(/\[[\s\S]*\]/)?.[0],
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try the next candidate.
    }
  }

  return fallback;
};
