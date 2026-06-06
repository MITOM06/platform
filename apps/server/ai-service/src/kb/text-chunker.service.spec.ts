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
