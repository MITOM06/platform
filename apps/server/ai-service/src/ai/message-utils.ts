import Anthropic from '@anthropic-ai/sdk';
import { RagSource } from './rag-source.type';

/**
 * Merge pre-retrieved RAG sources with tool-produced (web) sources into a single
 * contiguous array that matches the `[Source N]` numbering the model emits.
 *
 * Ordering assumption: RAG/KB context is injected into the system prompt BEFORE
 * the loop (numbered [Source 1..k]); the web-search tool then numbers its own
 * results [Source 1..m] in its tool_result text. The model, seeing both, emits
 * markers against whichever it cites — so we keep RAG first, web after, and let
 * the array index be the chip order. De-duped by documentId (KB ids are document
 * ids; web ids are distinct `web:N`, so they never collapse together).
 */
export function mergeSources(rag: RagSource[], web: RagSource[]): RagSource[] {
  const seen = new Set<string>();
  const out: RagSource[] = [];
  for (const s of [...rag, ...web]) {
    if (seen.has(s.documentId)) continue;
    seen.add(s.documentId);
    out.push(s);
  }
  return out;
}

/**
 * Normalize an assembled Anthropic messages array so it is a valid alternation
 * the API will accept. This is the single defense against the two ways history
 * can violate role rules:
 *   - an orphan `user` turn (a failed turn persisted the user but no assistant)
 *     followed by the next `user` turn → two consecutive `user` turns;
 *   - compaction summary priming (synthetic `assistant`) placed before a kept
 *     slice that itself starts with an `assistant` turn → two consecutive
 *     `assistant` turns.
 *
 * Rules:
 *   1. Drop leading `assistant` message(s) so the array starts with `user`.
 *   2. Merge consecutive same-role turns whose content is PLAIN TEXT (string),
 *      concatenating with `\n\n`.
 *   3. NEVER merge into/over a turn whose content is a block array (image /
 *      multimodal). Those turns pass through untouched so vision stays intact.
 *      (A same-role block-array turn adjacent to a string turn is left as-is —
 *      the vision pipeline already positions image turns so this does not
 *      arise in the text-continuity paths that #1/#2 protect.)
 */
export function normalizeMessages(
  messages: Anthropic.MessageParam[],
): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const msg of messages) {
    // Rule 1: skip any leading assistant turn(s).
    if (out.length === 0 && msg.role === 'assistant') continue;

    const prev = out[out.length - 1];
    // Rule 2 + 3: merge only when BOTH adjacent turns are same-role plain text.
    if (
      prev &&
      prev.role === msg.role &&
      typeof prev.content === 'string' &&
      typeof msg.content === 'string'
    ) {
      prev.content = `${prev.content}\n\n${msg.content}`;
      continue;
    }
    // Shallow copy so mutating `prev.content` above never touches the caller's
    // objects (image block arrays are shared by reference but never mutated).
    out.push({ ...msg });
  }
  return out;
}
