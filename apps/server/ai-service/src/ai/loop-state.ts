import Anthropic from '@anthropic-ai/sdk';
import { ToolContext, ToolDefinition } from '../tools/tool.interface';
import type { PendingActionView } from '../actions/pending-action.types';
import { RagSource } from './rag-source.type';
import { ToolTraceEntry } from './ai.types';
import { TokenCounts } from '../usage/token-counts';

/**
 * Everything an agentic run has accumulated. It outlives a failed model call:
 * when the primary model dies mid-loop, the fallback model CONTINUES from this
 * state — completed tool_use/tool_result turns included — instead of starting
 * over. Restarting re-ran tools that already executed: an email sent at
 * iteration 0 was sent again when iteration 1's stream failed (529/network).
 */
export interface LoopState {
  readonly system: Anthropic.TextBlockParam[];
  /** What Anthropic receives: name / description / input_schema only. */
  readonly tools: Anthropic.Tool[];
  /**
   * The same tools by name WITH internal metadata (connector `sensitive` flag).
   * A connector tool the model asks for that is not in here is refused.
   */
  readonly offeredTools: ReadonlyMap<string, ToolDefinition>;
  readonly toolCtx: ToolContext;
  /** The requester's message of this turn (context for a confirmed action's follow-up). */
  readonly requestText: string;
  /** The Anthropic message list; completed tool rounds are appended in place. */
  readonly messages: Anthropic.MessageParam[];
  /** Reply-wide citation list (KB sources first), shared with tools via toolCtx.sourceSink. */
  readonly citations: RagSource[];
  /** Whether the prompt carries image blocks (answer not reusable from the response cache). */
  readonly hasImages: boolean;
  toolCalls: ToolTraceEntry[];
  thinkingBlocks: string[];
  /** Tokens of every completed model call of this run, across models. */
  usage: TokenCounts;
  /** Completed tool rounds (shared MAX_ITER budget across primary + fallback). */
  iteration: number;
  /** Text already streamed to the client in completed tool rounds. */
  carriedText: string;
  /** Tools actually executed in this run (a pending action is NOT executed — not counted). */
  toolsExecuted: number;
  /**
   * Sensitive actions held for the user's confirmation, keyed by call
   * fingerprint (tool + input) so a repeated request — e.g. by the fallback
   * model after a continuation — reuses the same pending action.
   */
  readonly pendingActions: Map<string, PendingActionView>;
  /** Thinking mode the completed rounds ran with (null before the first call). */
  thinkingMode: boolean | null;
}

/**
 * The stream died after it had already sent text for the CURRENT turn — the
 * half-written answer is on screen, so neither a retry nor the fallback may
 * write a second one after it. (Message kept for log/grep continuity.)
 */
export class StreamInterruptedError extends Error {
  constructor(readonly original?: unknown) {
    super('STREAM_ALREADY_STARTED');
    this.name = 'StreamInterruptedError';
  }
}
