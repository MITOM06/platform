import { Injectable } from '@nestjs/common';

@Injectable()
export class TextChunkerService {
  chunk(text: string, chunkSize = 512, overlap = 80): string[] {
    const cleaned = text.replace(/[\s\n\r]+/g, ' ').trim();
    if (!cleaned) return [];

    // Split on sentence boundaries
    const sentenceRe = /(?<=[.!?])\s+/;
    const sentences = cleaned.split(sentenceRe).filter((s) => s.length > 0);

    const chunks: string[] = [];
    let current = '';
    let overlapBuffer = '';

    for (const sentence of sentences) {
      const candidate = overlapBuffer
        ? `${overlapBuffer} ${sentence}`.trim()
        : sentence;

      if (current) {
        const merged = `${current} ${candidate}`.trim();
        if (merged.length <= chunkSize) {
          current = merged;
        } else {
          if (current.length >= 50) chunks.push(current);
          // Carry overlap chars from end of current chunk
          overlapBuffer = current.length > overlap ? current.slice(-overlap).trim() : current;
          current = `${overlapBuffer} ${sentence}`.trim();
          if (current.length > chunkSize) {
            // Sentence alone is too long — split by char
            let pos = 0;
            while (pos < current.length) {
              const slice = current.slice(pos, pos + chunkSize).trim();
              if (slice.length >= 50) chunks.push(slice);
              pos += chunkSize - overlap;
            }
            current = '';
            overlapBuffer = '';
          }
        }
      } else {
        current = candidate;
        overlapBuffer = '';
      }
    }

    if (current.length >= 50) chunks.push(current);

    return chunks;
  }
}
