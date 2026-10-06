/**
 * In-chat confirmation of sensitive AI actions (CONTRACTS-ROUND2 §F2).
 *
 * When the model asks for a connector write that connector-service flags
 * `sensitive`, the loop does NOT run it: it stores a pending action here, tells
 * the model the action is waiting for the user, and the clients render a
 * confirmation card. Only the requester can confirm (runs the STORED input
 * once) or cancel it, until `expiresAt`.
 */

export const PENDING_ACTION_KEY_PREFIX = 'ai:pending-action:';

/** Redis key of one pending action record (JSON). */
export function pendingActionKey(id: string): string {
  return `${PENDING_ACTION_KEY_PREFIX}${id}`;
}

/** Redis key of the single-use claim (`SET NX`) taken by the first confirm/cancel. */
export function pendingActionClaimKey(id: string): string {
  return `${PENDING_ACTION_KEY_PREFIX}${id}:claim`;
}

/** Redis pub/sub channel chat-service listens on to update the card's status. */
export const ACTION_RESOLVED_CHANNEL = 'ai:action:resolved';

/** Default confirmation window (`AI_PENDING_ACTION_TTL_SEC`). */
export const DEFAULT_PENDING_ACTION_TTL_SEC = 600;

/** The record outlives `expiresAt` by this much so a late click gets 410, not 404. */
export const PENDING_ACTION_EXPIRED_GRACE_SEC = 300;

export type PendingActionStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed';
export type ResolvedActionStatus = Exclude<PendingActionStatus, 'pending'>;

/**
 * Humanized, non-secret description of what will happen, built from the tool
 * input (never the body, ids, tokens or links). Clients localize by `kind`;
 * every string is single-line and length-capped.
 */
export type PendingActionSummary =
  | { kind: 'send_email' | 'draft_email'; to?: string; subject?: string }
  | { kind: 'create_event' | 'update_event'; title?: string; start?: string; end?: string }
  | { kind: 'create_page' | 'update_page'; title?: string }
  | { kind: 'generic'; tool: string };

/** What the clients see — `AI_ACTION_PENDING.action` and `AI_STREAM_DONE.pendingActions[]`. */
export interface PendingActionView {
  id: string;
  /** Namespaced tool name (`mcp__<provider>__<tool>`) — machine value, not display text. */
  toolName: string;
  /** Connector slug (`gmail`, `calendar`, `notion`, a directory slug or `custom_<id>`). */
  provider: string;
  summary: PendingActionSummary;
  status: 'pending';
  /** ISO instant after which the action can no longer be confirmed. */
  expiresAt: string;
}

/** The Redis record (`ai:pending-action:{id}`). Internal — never returned to a client. */
export interface PendingActionRecord {
  id: string;
  /** The requester — the only user who may confirm or cancel. */
  userId: string;
  conversationId: string;
  /** The AI reply (bubble) that carries the confirmation card. */
  replyId: string;
  toolName: string;
  /** Exactly what runs on confirm. The confirm request body is never read. */
  input: Record<string, unknown>;
  provider: string;
  summary: PendingActionSummary;
  createdAt: string;
  expiresAt: string;
  /** Requester display name, for the follow-up reply's persona prompt. */
  displayName: string;
  departmentId?: string;
  /** The requester's message (capped), so the follow-up answers in their language. */
  requestText: string;
}

/** Published on {@link ACTION_RESOLVED_CHANNEL}. */
export interface ActionResolvedEvent {
  actionId: string;
  conversationId: string;
  /** Additive: the reply whose card changed. chat-service matches on `pendingActions.id`. */
  replyId: string;
  status: ResolvedActionStatus;
  /** Failure code only (e.g. `NOT_PERMITTED`, `OUTCOME_UNKNOWN`); absent on success. */
  resultSummary?: string;
}

/** Error `code`s of `POST /ai/actions/:id/{confirm,cancel}` (top-level in the body). */
export const PendingActionErrorCode = {
  NOT_FOUND: 'ACTION_NOT_FOUND',
  NOT_OWNER: 'ACTION_NOT_OWNER',
  ALREADY_RESOLVED: 'ACTION_ALREADY_RESOLVED',
  EXPIRED: 'ACTION_EXPIRED',
} as const;

/** Result of executing a confirmed action. */
export interface ActionOutcome {
  status: 'confirmed' | 'failed';
  /** Machine failure code; absent on success. */
  code?: string;
  /** Raw connector result (untrusted) — only ever shown to the model, fenced. */
  result: string;
}
