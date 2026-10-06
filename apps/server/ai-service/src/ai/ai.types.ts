import { RagSource } from './rag-source.type';
import { ResolvedAiSettings } from '../settings/resolved-ai-settings';

/**
 * One conversation-history entry in the `ai.requests` payload (TASK-10 contract).
 * Text turns carry `role` + `content`. An image turn additionally sets
 * `type: 'image'` + `imageUrls` (relative `/api/uploads/{id}` paths, JSON-array
 * decoded by chat-service); ai-service resolves those to image content blocks.
 * Backward compatible: absent `type`/`imageUrls` ⇒ plain text.
 *
 * Sender attribution (optional, additive): `senderId` + `senderName` let the AI
 * see who said what when it is @mentioned in a shared chat. `senderDisplayName`
 * and `displayName` are accepted as aliases of `senderName`. Names are display
 * text only — ids are never shown to the model.
 */
export interface AiHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  type?: string;
  imageUrls?: string[];
  senderId?: string;
  senderName?: string;
  senderDisplayName?: string;
  displayName?: string;
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
  /** TOTAL prompt tokens across the reply's model calls (cache writes + reads included). */
  inputTokens: number;
  outputTokens: number;
  /** Prompt-cache reads — subset of `inputTokens` (savings indicator). */
  cachedInputTokens: number;
  /** Prompt-cache writes — subset of `inputTokens`. */
  cacheCreationInputTokens: number;
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
  /** KB sources injected into the system prompt, numbered [Source 1..n] in order. */
  ragSources: RagSource[];
  /** Embedded user query — used to populate the semantic response cache. */
  queryVector?: number[] | null;
  /**
   * Whether the answer may be stored in the semantic response cache. False when
   * it depends on more than the question (e.g. the recent group conversation).
   */
  responseCacheable?: boolean;
  /** Resolved workspace AI settings (TASK-12) threaded into the loop. */
  settings: ResolvedAiSettings;
  /** Skill ids enabled for this user; gates action-skill MCP tools in the registry. */
  enabledSkillIds?: string[];
}
