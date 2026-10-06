import { RagSource } from './rag-source.type';

/**
 * One numbering for every citable source of a reply.
 *
 * The system-prompt KB block numbers documents [Source 1..k]; every tool that
 * returns citable results then registers them in the SAME request-wide list
 * (`ToolContext.sourceSink`, seeded with the KB sources) and prints the number
 * it gets back. So `[Source N]` in the answer is always `sources[N-1]` of
 * AI_STREAM_DONE — the order the clients render the chips in. KB-tool hits and
 * web results used to restart at 1 and pointed at the wrong chip.
 *
 * KB entries dedupe by documentId (several chunks of one document share its
 * number), web entries by URL.
 */
export function registerKbSource(
  sources: RagSource[],
  source: { documentId: string; fileName: string; score: number },
): number {
  const existing = sources.findIndex((s) => s.type !== 'web' && s.documentId === source.documentId);
  if (existing >= 0) return existing + 1;
  sources.push({ documentId: source.documentId, fileName: source.fileName, score: source.score });
  return sources.length;
}

export function registerWebSource(
  sources: RagSource[],
  source: { title: string; url: string },
): number {
  const existing = sources.findIndex((s) => s.type === 'web' && s.url === source.url);
  if (existing >= 0) return existing + 1;
  const number = sources.length + 1;
  // `web:<n>` stays unique within the reply (clients key + dedupe chips by documentId).
  sources.push({
    documentId: `web:${number}`,
    fileName: source.title || source.url,
    score: 1,
    url: source.url,
    type: 'web',
  });
  return number;
}
