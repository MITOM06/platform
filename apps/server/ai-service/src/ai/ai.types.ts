import { RagSource } from './rag-source.type';
import { ResolvedAiSettings } from '../settings/resolved-ai-settings';

/**
 * One conversation-history entry in the `ai.requests` payload (TASK-10 contract).
 * Text turns carry only `role` + `content` (byte-identical to before). An image
 * turn additionally sets `type: 'image'` + `imageUrls` (relative `/api/uploads/{id}`
 * paths, JSON-array decoded by chat-service); ai-service resolves those to image
 * content blocks. Backward compatible: absent `type`/`imageUrls` ⇒ plain text.
 */
export interface AiHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  type?: string;
  imageUrls?: string[];
}

export interface AiRequestPayload {
  conversationId: string;
  userId: string;
  displayName: string;
  content: string;
  history: AiHistoryEntry[];
  /** Owning department id of the conversation (P6 group bot); null for personal. */
  departmentId?: string;
  /** Role NAME from the caller's JWT (e.g. 'Owner'|'Admin'|'Manager'|'Member'); absent for legacy tokens. */
  role?: string;
  /** Enabled capability keys from the JWT `perms` claim; absent ⇒ treat as no capabilities. */
  perms?: string[];
  /** Department ids the caller belongs to (JWT `depts` claim); absent ⇒ no departments. */
  departmentIds?: string[];
}

export interface ToolTraceEntry {
  toolName: string;
  inputSummary: string;
  resultSummary: string;
}

export interface AiTrace {
  thinkingBlocks: string[];
  toolCalls: ToolTraceEntry[];
  inputTokens: number;
  outputTokens: number;
  /** Input tokens served from the Anthropic prompt cache (savings indicator). */
  cachedInputTokens: number;
  thinkingTokens: number;
  processingMs: number;
  model: string;
  iterationCount: number;
}

export interface RequestContext {
  conversationId: string;
  userId: string;
  displayName: string;
  /** Owning department id (P6 group bot); scopes KB retrieval when present. */
  departmentId?: string;
  /** Caller role NAME for the org-context block (may be undefined for legacy tokens). */
  role?: string;
  /** Resolved caller capabilities — gates which context entries are injected. */
  perms: string[];
  /** Resolved caller department ids — gates department-scoped context entries. */
  departmentIds: string[];
  /** Stable, cacheable persona + grounding contract. */
  baseSystem: string;
  /** Volatile per-request grounding block (RAG + memory). Placed AFTER cache. */
  volatileSystem: string;
  ragSources: RagSource[];
  /** Embedded user query — used to populate the semantic response cache. */
  queryVector?: number[] | null;
  /** Resolved workspace AI settings (TASK-12) threaded into the loop. */
  settings: ResolvedAiSettings;
  /** Skill ids enabled for this user; gates action-skill MCP tools in the registry. */
  enabledSkillIds?: string[];
}
