/**
 * Shared shape for a citable source attached to an AI answer.
 *
 * Lives in its own tiny module so BOTH `context-builder.service.ts` (which
 * produces KB/RAG sources before the agentic loop) and the tools layer
 * (`tool.interface.ts` → web-search tool, which produces web sources inside the
 * loop) can depend on it without a circular import.
 *
 * The two OPTIONAL fields keep KB and web sources on a single render path:
 *   - `url`  — present only for web sources; clients open it externally.
 *   - `type` — absent ⇒ treated as 'kb' (backward compatible with TASK-06).
 */
export interface RagSource {
  /**
   * Stable id used by clients to dedupe chips. KB: the kb_documents id.
   * Web: a synthetic stable id (`web:<n>`) so multiple web results stay distinct.
   */
  documentId: string;
  /** Display label. KB: filename ('' when unknown). Web: the page title. */
  fileName: string;
  score: number;
  /** NEW — present only for web sources; clients open this externally. */
  url?: string;
  /** NEW — defaults to 'kb' when absent (backward compatible). */
  type?: 'kb' | 'web';
}
