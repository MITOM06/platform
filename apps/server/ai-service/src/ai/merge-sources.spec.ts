import { mergeSources } from './ai.service';
import { RagSource } from './rag-source.type';
import { isSensitiveTool } from './injection-guard';

const kb = (id: string): RagSource => ({ documentId: id, fileName: `${id}.pdf`, score: 0.9 });
const web = (i: number): RagSource => ({
  documentId: `web:${i}`,
  fileName: `Web ${i}`,
  score: 1,
  url: `https://e.example/${i}`,
  type: 'web',
});

describe('mergeSources', () => {
  it('places RAG sources first, then web sources, contiguously', () => {
    const out = mergeSources([kb('doc1'), kb('doc2')], [web(0), web(1)]);
    expect(out.map((s) => s.documentId)).toEqual(['doc1', 'doc2', 'web:0', 'web:1']);
  });

  it('de-dupes by documentId (keeps first occurrence)', () => {
    const out = mergeSources([kb('doc1'), kb('doc1')], [web(0), web(0)]);
    expect(out.map((s) => s.documentId)).toEqual(['doc1', 'web:0']);
  });

  it('does not collapse distinct web ids together', () => {
    const out = mergeSources([], [web(0), web(1), web(2)]);
    expect(out).toHaveLength(3);
  });

  it('returns RAG-only unchanged when there are no web sources', () => {
    const rag = [kb('doc1')];
    expect(mergeSources(rag, [])).toEqual(rag);
  });
});

describe('web_search sensitivity', () => {
  it('is NOT a sensitive tool (read-only, cacheable, no confirmation prompt)', () => {
    expect(isSensitiveTool('web_search')).toBe(false);
  });
});
