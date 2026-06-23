import { RagSource } from '../ai/rag-source.type';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required: string[] };
}

export interface ToolContext {
  conversationId: string;
  userId: string;
  displayName: string;
  /** Owning department id (P6 group bot); scopes KB retrieval when present. */
  departmentId?: string;
  /**
   * Mutable per-request sink the agentic loop creates and tools push citable
   * sources into (e.g. the web-search tool). The loop merges these with the
   * pre-retrieved RAG sources when publishing `AI_STREAM_DONE`, so tool-produced
   * sources flow into the existing `[Source N]` citation contract. Optional —
   * absent for code paths that don't run the loop (e.g. cached answers).
   */
  sourceSink?: RagSource[];
  /**
   * Workspace web-search toggle (TASK-12). `false` ⇒ never offer `web_search`,
   * composing with the provider-configured gate. `undefined`/`true` ⇒ env
   * behavior (offered iff a provider is configured).
   */
  webSearchEnabled?: boolean;
  /**
   * Workspace AI connector allow-list (TASK-12), catalog connector ids. When
   * non-null, `mcp__<provider>__*` tools are filtered to providers in this list
   * (`[]` ⇒ no MCP tools). `undefined`/`null` ⇒ no AI-specific filtering.
   */
  allowedConnectors?: string[] | null;
}
