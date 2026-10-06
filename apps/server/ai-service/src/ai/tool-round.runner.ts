import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { isConnectorTool } from '../tools/tool-names';
import { PendingActionStore, toPendingActionView } from '../actions/pending-action.store';
import { needsConfirmation } from '../actions/pending-action-policy';
import { isSensitiveTool, wrapUntrusted } from './injection-guard';
import { AiReplyStream } from './ai-reply-stream';
import { LoopState } from './loop-state';

/** Tool result for a connector tool that was not offered in this request (never executed). */
export const TOOL_NOT_OFFERED_RESULT =
  'Tool error: [UNKNOWN_TOOL] this tool is not available in this conversation. Do not call it again.';

/** Tool result for a sensitive action held for the user's confirmation (NOT executed). */
export const PENDING_CONFIRMATION_RESULT =
  'PENDING_USER_CONFIRMATION: this action has NOT been performed. It is waiting for the user to ' +
  'confirm it in the app — a confirmation card is shown under your reply. Do not call this tool ' +
  'again for this request and do not say it was done. End your turn by briefly telling the user ' +
  'what will happen once they confirm.';

/** Tool result when the pending action could not be stored (fails closed — nothing ran). */
export const PENDING_STAGE_FAILED_RESULT =
  'Tool error: this action could not be prepared for confirmation and was NOT performed. ' +
  'Tell the user to try again in a moment.';

function errorResult(block: Anthropic.ToolUseBlock, content: string): Anthropic.ToolResultBlockParam {
  return { type: 'tool_result', tool_use_id: block.id, is_error: true, content };
}

/** Canonical JSON (sorted keys) — the same call always gets the same fingerprint. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * One round of tool calls of the agentic loop.
 *
 * The single place a model-requested tool runs — for the primary model and for
 * the fallback continuing the same `LoopState` alike:
 *  - a connector tool that was not offered this request is refused;
 *  - a connector tool that needs confirmation (`needsConfirmation`) is NOT run:
 *    it becomes a pending action (Redis), `AI_ACTION_PENDING` goes to the
 *    client and the model is told it waits for the user;
 *  - everything else executes through the registry.
 */
@Injectable()
export class ToolRoundRunner {
  private readonly logger = new Logger(ToolRoundRunner.name);

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly pendingActionStore: PendingActionStore,
  ) {}

  /**
   * Run the round and append the assistant + tool_result turns. Committed even
   * when a step throws: every tool_use needs its tool_result, and a tool that
   * already ran must stay recorded as run so a continuation on the fallback
   * model never executes it again.
   */
  async run(
    message: Anthropic.Message,
    toolUses: Anthropic.ToolUseBlock[],
    state: LoopState,
    stream: AiReplyStream,
  ): Promise<void> {
    const results: Anthropic.ToolResultBlockParam[] = [];
    try {
      for (const block of toolUses) {
        results.push(await this.runOne(block, state, stream));
      }
    } finally {
      for (const block of toolUses.slice(results.length)) {
        results.push(errorResult(block, 'Tool error: this tool was not executed (internal error).'));
      }
      state.messages.push({ role: 'assistant', content: message.content });
      state.messages.push({ role: 'user', content: results });
      state.iteration++;
    }
  }

  /** Delete the pending actions of a reply that ended in an error (no card survives it). */
  async discardPending(state: LoopState): Promise<void> {
    const ids = [...state.pendingActions.values()].map((a) => a.id);
    await this.pendingActionStore.discard(ids);
  }

  private async runOne(
    block: Anthropic.ToolUseBlock,
    state: LoopState,
    stream: AiReplyStream,
  ): Promise<Anthropic.ToolResultBlockParam> {
    const input = (block.input ?? {}) as Record<string, unknown>;
    const inputSummary = JSON.stringify(block.input ?? {}).slice(0, 100);
    const offered = state.offeredTools.get(block.name);

    // Only tools offered THIS request may run: the AI connector allow-list and
    // the skill gate are applied when offering, so an unlisted (hallucinated or
    // filtered) connector tool must never reach connector-service.
    if (isConnectorTool(block.name) && !offered) {
      this.logger.warn(`Refusing connector tool ${block.name}: not offered in this request`);
      state.toolCalls.push({ toolName: block.name, inputSummary, resultSummary: 'Not available' });
      return errorResult(block, TOOL_NOT_OFFERED_RESULT);
    }

    const sensitive = offered?.sensitive === true || isSensitiveTool(block.name);
    await stream.toolCall(block.name, inputSummary, sensitive);

    if (needsConfirmation(block.name, offered)) {
      return this.holdForConfirmation(block, input, inputSummary, state, stream);
    }

    const result = await this.toolRegistry.execute(block.name, input, state.toolCtx, {
      sensitive: offered?.sensitive === true,
    });
    state.toolsExecuted++;
    state.toolCalls.push({ toolName: block.name, inputSummary, resultSummary: result.slice(0, 200) });
    // Fence tool output as UNTRUSTED before it re-enters the model context
    // (indirect prompt-injection surface). web_search fences at source.
    const fenced =
      block.name === 'web_search' ? result : wrapUntrusted(`Tool Result: ${block.name}`, result) || result;
    return { type: 'tool_result', tool_use_id: block.id, content: fenced || '(no output)' };
  }

  /** Stage (or reuse) the pending action; the tool itself never runs here. */
  private async holdForConfirmation(
    block: Anthropic.ToolUseBlock,
    input: Record<string, unknown>,
    inputSummary: string,
    state: LoopState,
    stream: AiReplyStream,
  ): Promise<Anthropic.ToolResultBlockParam> {
    const fingerprint = `${block.name}:${canonicalJson(input)}`;
    if (!state.pendingActions.has(fingerprint)) {
      try {
        const record = await this.pendingActionStore.create({
          userId: state.toolCtx.userId,
          displayName: state.toolCtx.displayName,
          conversationId: state.toolCtx.conversationId,
          departmentId: state.toolCtx.departmentId,
          replyId: stream.replyId,
          toolName: block.name,
          input,
          requestText: state.requestText,
        });
        const view = toPendingActionView(record);
        state.pendingActions.set(fingerprint, view);
        this.logger.log(`Holding ${block.name} for confirmation as action ${view.id}`);
        await stream
          .actionPending(view)
          .catch((err) =>
            this.logger.warn(`Could not publish AI_ACTION_PENDING ${view.id}: ${(err as Error).message}`),
          );
      } catch (err) {
        this.logger.error(`Could not stage ${block.name} for confirmation`, err);
        state.toolCalls.push({ toolName: block.name, inputSummary, resultSummary: 'Not performed' });
        return errorResult(block, PENDING_STAGE_FAILED_RESULT);
      }
    }
    state.toolCalls.push({
      toolName: block.name,
      inputSummary,
      resultSummary: 'Awaiting user confirmation',
    });
    return { type: 'tool_result', tool_use_id: block.id, content: PENDING_CONFIRMATION_RESULT };
  }
}
