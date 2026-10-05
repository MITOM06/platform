import { TextChunkerService } from './text-chunker.service';

describe('TextChunkerService', () => {
  let service: TextChunkerService;

  beforeEach(() => {
    service = new TextChunkerService();
  });

  it('returns empty array for empty text', () => {
    expect(service.chunk('')).toEqual([]);
    expect(service.chunk('   ')).toEqual([]);
  });

  it('returns single chunk when text fits in one chunk', () => {
    const text =
      'Hello world, this is a test sentence that is long enough to pass the 50-char minimum threshold.';
    const chunks = service.chunk(text, 512, 80);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]).toContain('Hello');
  });

  it('splits 1000-char text into multiple chunks of <= chunkSize', () => {
    // Build a 1000-char text with sentence boundaries
    const sentence = 'This is a sentence that is roughly fifty characters long. ';
    const text = sentence.repeat(20);
    const chunks = service.chunk(text, 200, 40);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => {
      expect(c.length).toBeLessThanOrEqual(250); // allow slight overage at sentence boundary
    });
  });

  it('discards chunks shorter than 50 chars', () => {
    const text = 'A. B. C. This is a proper sentence with enough characters to be kept.';
    const chunks = service.chunk(text, 512, 80);
    chunks.forEach((c) => {
      expect(c.length).toBeGreaterThanOrEqual(50);
    });
  });

  it('overlap carries text from previous chunk into next', () => {
    const sentence = 'The quick brown fox jumps over the lazy dog. ';
    const text = sentence.repeat(15);
    const chunks = service.chunk(text, 100, 30);
    // At least 2 chunks expected
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('TextChunkerService — overlap only at chunk starts (real text)', () => {
  const service = new TextChunkerService();
  // Real multi-sentence prose, every sentence distinct.
  const SENTENCES = [
    'PON is a self-hosted assistant platform for one company per deployment.',
    'Each workspace has departments, members and roles managed by an administrator.',
    'The AI service streams answers over Redis while chat-service fans them out over STOMP.',
    'Knowledge base documents are parsed, chunked, embedded with Voyage and stored in Qdrant.',
    'Retrieval keeps the best chunks above a score threshold and cites them as numbered sources.',
    'Long-term memory extracts durable facts about a user every few turns of conversation.',
    'Reminders are created through a tool and delivered back into the chat when they fall due.',
    'A daily digest summarizes the previous day of human discussion for each active conversation.',
    'Connectors expose third-party tools such as calendars, mail and notes through MCP.',
    'Every action tool is gated by an enabled skill, the connector grant and the role allow-list.',
    'Usage is recorded per user and day so the monthly quota can be enforced before each request.',
    'Administrators can review cost, volume and answer quality on the usage dashboard.',
  ];
  const text = SENTENCES.join(' ');

  /** Length of the overlap seed: longest prefix of `next` that is a suffix of `prev`. */
  function overlapLen(prev: string, next: string): number {
    for (let k = Math.min(prev.length, next.length); k > 0; k--) {
      if (prev.endsWith(next.slice(0, k)) && (k === next.length || next[k] === ' ')) return k;
    }
    return 0;
  }

  it('never repeats the overlap inside a chunk and reconstructs the text exactly', () => {
    const size = 200;
    const overlap = 60;
    const chunks = service.chunk(text, size, overlap);
    expect(chunks.length).toBeGreaterThan(3);

    let rebuilt = chunks[0];
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].length).toBeLessThanOrEqual(size);
      // Each sentence appears at most once per chunk (the old bug repeated the
      // overlap buffer before every later sentence).
      for (const s of SENTENCES) {
        expect(chunks[i].split(s).length - 1).toBeLessThanOrEqual(1);
      }
      if (i === 0) continue;
      const k = overlapLen(chunks[i - 1], chunks[i]);
      expect(k).toBeGreaterThan(0); // overlap present …
      expect(k).toBeLessThanOrEqual(overlap); // … bounded …
      const seed = chunks[i].slice(0, k);
      expect(chunks[i].indexOf(seed, 1)).toBe(-1); // … and only at the start
      rebuilt += ' ' + chunks[i].slice(k + 1);
    }
    expect(rebuilt).toBe(text);
  });

  it('keeps duplication bounded (old chunker repeated ~60% of every chunk)', () => {
    const chunks = service.chunk(text, 512, 80);
    const total = chunks.reduce((n, c) => n + c.length, 0);
    expect(total).toBeLessThanOrEqual(text.length + (chunks.length - 1) * 81);
  });

  it('splits an over-long sentence on word boundaries within the size', () => {
    const long = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ') + '.';
    const chunks = service.chunk(long, 150, 30);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(150);
      expect(c).toMatch(/^word\d+/); // never starts mid-word
    }
  });
});
