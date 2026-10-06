import { Injectable } from '@nestjs/common';

/** A document shorter than this has no meaningful content to index. */
const MIN_DOCUMENT_CHARS = 50;

/**
 * Sentence-packing chunker with a bounded overlap.
 *
 * Sentences are packed into chunks of at most `chunkSize` chars. When a chunk is
 * full, the next one starts with a short tail of it (≤ `overlap` chars, cut on a
 * word boundary) so a fact straddling the boundary is retrievable from either
 * side. The overlap appears ONCE, at the start of a chunk: the previous version
 * re-inserted the overlap buffer before every later sentence of the chunk, so
 * ~60% of each chunk was repeated text (worse retrieval, more embedding tokens).
 *
 * A sentence longer than a chunk is split into word-aligned pieces first, so
 * every chunk — overlap included — stays within `chunkSize`.
 */
@Injectable()
export class TextChunkerService {
  chunk(text: string, chunkSize = 512, overlap = 80): string[] {
    const cleaned = (text ?? '').replace(/\s+/g, ' ').trim();
    if (cleaned.length < MIN_DOCUMENT_CHARS) return [];

    const size = Math.max(1, Math.floor(chunkSize));
    // An overlap at least half the chunk would make each chunk mostly repeat.
    const tailSize = Math.max(0, Math.min(Math.floor(overlap), Math.floor(size / 2)));
    // Reserve room for "<tail> " so tail + piece never exceeds the chunk size.
    const maxPiece = tailSize > 0 ? size - tailSize - 1 : size;

    const pieces = cleaned
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.length > 0)
      .flatMap((s) => (s.length <= maxPiece ? [s] : splitLong(s, maxPiece)));

    const chunks: string[] = [];
    let current = '';
    // Whether `current` holds text not already emitted (i.e. more than its overlap seed).
    let hasNew = false;
    for (const piece of pieces) {
      const merged = current ? `${current} ${piece}` : piece;
      if (merged.length <= size) {
        current = merged;
        hasNew = true;
        continue;
      }
      if (hasNew) chunks.push(current);
      const tail = overlapTail(current, tailSize);
      current = tail ? `${tail} ${piece}` : piece;
      hasNew = true;
    }
    if (hasNew && current) chunks.push(current);
    return chunks;
  }
}

/**
 * The last ≤ `max` chars of `text`, starting at a word boundary so the overlap
 * never begins mid-word. '' when the tail would be a single cut-off word.
 */
function overlapTail(text: string, max: number): string {
  if (max <= 0 || !text) return '';
  if (text.length <= max) return text;
  const raw = text.slice(-max);
  const firstSpace = raw.indexOf(' ');
  // The cut fell inside a word: drop that partial word.
  const startsMidWord = text[text.length - max - 1] !== ' ';
  if (!startsMidWord) return raw.trim();
  return firstSpace >= 0 ? raw.slice(firstSpace + 1).trim() : '';
}

/** Split an over-long sentence into ≤ `max`-char pieces, on spaces where possible. */
function splitLong(sentence: string, max: number): string[] {
  const out: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut <= 0) cut = max; // one huge "word" (URL, base64): hard cut
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.filter((p) => p.length > 0);
}
