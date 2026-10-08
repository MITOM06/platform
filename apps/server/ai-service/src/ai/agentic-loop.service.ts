import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ResponseCacheService } from './response-cache.service';
import { ChatImageService } from './chat-image.service';
import { ToolContext, ToolDefinition } from '../tools/tool.interface';
import { RagSource } from './rag-source.type';
import { modelSupportsAdaptiveThinking, modelSupportsEffort } from './model-router';
import { normalizeMessages } from './message-utils';
import { AiHistoryEntry, AiTrace, RequestContext } from './ai.types';
import { AiReplyStream } from './ai-reply-stream';
import { AiStreamErrorCode, AiStreamErrorCodeValue } from './ai-stream-error';
import { LoopState, StreamInterruptedError } from './loop-state';
import { withAgenticLoopSpan } from './tracing-helpers';
import { ToolRoundRunner } from './tool-round.runner';
import { ACTION_PENDING_FALLBACK_TEXT } from './system-notices';
import { addTokens, countTokens, zeroTokens } from '../usage/token-counts';
import { LlmClient } from '../llm/openrouter-client';

const MAX_ITER = 5;
const MAX_ITER_NOTICE = 'I had trouble completing that action. Please try again.';
const INTERRUPTED_MESSAGE = 'AI stream was interrupted. Please try again.';
const UNAVAILABLE_MESSAGE = 'AI is temporarily unavailable.';

export interface LoopRunParams {
  /** Anthropic SDK client, or the OpenRouter client behind the same surface. */
  anthropic: LlmClient;
  model: string;
  ctx: RequestContext;
  state: LoopState;
  stream: AiReplyStream;
  startMs: number;
  /** Receives the final assistant text so the caller can persist it to the session. */
  resultSink?: { fullContent: string };
}

export interface FallbackRunParams extends Omit<LoopRunParams, 'model'> {
  primaryModel: string;
  fallbackModel: string;
  /** Client for the fallback model when it differs from the primary's (OpenRouter → Claude). */
  fallbackClient?: LlmClient;
}

/**
 * Runs the streaming agentic loop against Anthropic: streams text deltas to the
 * reply stream; when a turn stops with `tool_use`, hands the round to
 * `ToolRoundRunner` (runs the tools, or holds a sensitive connector write for
 * the user's confirmation) and continues. All progress lives in a `LoopState` (see
 * loop-state.ts) so a failed model can be replaced mid-loop without redoing
 * work. The Anthropic client is passed in by the caller so per-request model
 * selection and test overrides apply.
 */
@Injectable()
export class AgenticLoopService {
  private readonly logger = new Logger(AgenticLoopService.name);
  private readonly effort: 'low' | 'medium' | 'high';
  private readonly promptCacheEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly responseCache: ResponseCacheService,
    private readonly chatImageService: ChatImageService,
    private readonly toolRound: ToolRoundRunner,
  ) {
    this.effort =
      (this.configService.get<string>('config.anthropic.effort') as 'low' | 'medium' | 'high') ??
      'high';
    this.promptCacheEnabled =
      this.configService.get<boolean>('config.cache.promptCacheEnabled') ?? true;
  }

  /** Build the run state: system blocks, tool list, normalized message list, citation list. */
  async prepare(
    ctx: RequestContext,
    userContent: string,
    history: AiHistoryEntry[],
  ): Promise<LoopState> {
    // Reply-wide citation list: KB sources (numbered in the system prompt) first;
    // KB/web tools register theirs after them (ai/source-registry).
    const citations: RagSource[] = [...ctx.ragSources];
    const toolCtx: ToolContext = {
      conversationId: ctx.conversationId,
      userId: ctx.userId,
      displayName: ctx.displayName,
      departmentId: ctx.departmentId,
      sourceSink: citations,
      // Workspace tool governance (TASK-12) + skill consent gate (Approach A).
      webSearchEnabled: ctx.settings.webSearchEnabled,
      allowedConnectors: ctx.settings.allowedConnectors,
      enabledSkillIds: ctx.enabledSkillIds,
    };
    const defs = await this.toolRegistry.getDefinitions(toolCtx);
    // Single chokepoint for the final messages array: normalizeMessages drops a
    // leading assistant turn and merges consecutive same-role PLAIN-TEXT turns
    // (no Anthropic 400); image turns are never merged.
    const messages: Anthropic.MessageParam[] = normalizeMessages([
      ...(await this.buildHistoryMessages(history)),
      { role: 'user', content: userContent },
    ]);
    return {
      system: this.buildSystemBlocks(ctx),
      tools: this.toAnthropicTools(defs),
      offeredTools: new Map(defs.map((d) => [d.name, d])),
      toolCtx,
      requestText: userContent,
      messages,
      citations,
      hasImages: messages.some(
        (m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'image'),
      ),
      toolCalls: [],
      thinkingBlocks: [],
      usage: zeroTokens(),
      iteration: 0,
      carriedText: '',
      toolsExecuted: 0,
      pendingActions: new Map(),
      thinkingMode: null,
    };
  }

  /**
   * Run on the primary model; if it fails, CONTINUE on the fallback model from
   * the accumulated state. Completed tool rounds stay in `state.messages`, so a
   * tool that already ran (an email send, a reminder, a calendar write) is never
   * executed a second time — and an action held for confirmation is reused, not
   * staged again (nor run). A turn that died after streaming text cannot be
   * resumed without a garbled bubble → AI_STREAM_INTERRUPTED instead; a reply
   * that ends in an error drops its pending actions.
   */
  async runWithFallback(p: FallbackRunParams): Promise<AiTrace> {
    const { primaryModel, fallbackModel, fallbackClient, ...rest } = p;
    const conversationId = p.ctx.conversationId;
    try {
      return await withAgenticLoopSpan(primaryModel, conversationId, () =>
        this.run({ ...rest, model: primaryModel }),
      );
    } catch (primaryError) {
      this.logger.error(`Model (${primaryModel}) failed for conversation ${conversationId}`, primaryError);
      if (primaryError instanceof StreamInterruptedError) {
        this.logger.warn(`Primary model failed mid-stream. No fallback for ${conversationId} (text already shown).`);
        await this.toolRound.discardPending(p.state);
        await this.publishError(p.stream, AiStreamErrorCode.STREAM_INTERRUPTED, INTERRUPTED_MESSAGE);
        throw primaryError;
      }
      if (p.state.toolsExecuted > 0) {
        this.logger.warn(
          `Continuing on ${fallbackModel} after ${p.state.toolsExecuted} executed tool(s) — ` +
            `completed tool rounds are kept, nothing is re-run`,
        );
      }
      try {
        return await withAgenticLoopSpan(fallbackModel, conversationId, () =>
          this.run({ ...rest, anthropic: fallbackClient ?? rest.anthropic, model: fallbackModel }),
        );
      } catch (fallbackError) {
        this.logger.error(
          `Fallback model (${fallbackModel}) also failed for conversation ${conversationId}`,
          fallbackError,
        );
        const interrupted = fallbackError instanceof StreamInterruptedError;
        // The reply ends in an error, so its confirmation card is never persisted.
        await this.toolRound.discardPending(p.state);
        await this.publishError(
          p.stream,
          interrupted ? AiStreamErrorCode.STREAM_INTERRUPTED : AiStreamErrorCode.UNAVAILABLE,
          interrupted ? INTERRUPTED_MESSAGE : UNAVAILABLE_MESSAGE,
        );
        throw fallbackError;
      }
    }
  }

  /**
   * Continue the loop from `state` on `model` until a final answer, then publish
   * DONE (or AI_EMPTY_RESPONSE). Usage is counted once per API call into
   * `state.usage` (input = uncached + cache writes + cache reads).
   */
  async run(p: LoopRunParams): Promise<AiTrace> {
    const { anthropic, model, ctx, state, stream } = p;
    const useThinking = this.resolveThinking(model, ctx, state);
    let finalText = '';
    let stopReason: string | null = null;

    while (state.iteration < MAX_ITER) {
      const { message, text } = await this.streamTurn(anthropic, model, state, stream, useThinking);
      state.usage = addTokens(state.usage, countTokens(message.usage));
      state.thinkingMode = useThinking;

      const toolUses = message.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (message.stop_reason === 'tool_use' && toolUses.length > 0) {
        // Text streamed before the tool call already reached the client — keep it
        // for the persisted message (newline-separated across rounds).
        if (text.trim()) state.carriedText = state.carriedText ? `${state.carriedText}\n${text}` : text;
        await this.toolRound.run(message, toolUses, state, stream);
        continue;
      }
      finalText = text;
      stopReason = message.stop_reason ?? null;
      break;
    }

    return this.finish(p, finalText, stopReason);
  }

  /** Workspace thinking toggle, applied to any routed model that supports adaptive thinking. */
  private resolveThinking(model: string, ctx: RequestContext, state: LoopState): boolean {
    const wanted = ctx.settings.thinkingEnabled && modelSupportsAdaptiveThinking(model);
    // Never switch thinking ON in the middle of a tool round: the pending
    // assistant tool_use turn has no thinking block and the API rejects that.
    if (wanted && state.iteration > 0 && state.thinkingMode === false) return false;
    return wanted;
  }

  /** Stream one model turn. Text deltas go to the client as they arrive. */
  private async streamTurn(
    anthropic: LlmClient,
    model: string,
    state: LoopState,
    stream: AiReplyStream,
    useThinking: boolean,
  ): Promise<{ message: Anthropic.Message; text: string }> {
    const request = anthropic.messages.stream({
      model,
      max_tokens: 4096,
      system: state.system,
      messages: state.messages,
      tools: state.tools,
      tool_choice: { type: 'auto' },
      // `output_config.effort` is only accepted by effort-capable models
      // (Opus 4.5+, Sonnet 4.6+, Sonnet 5, Fable/Mythos 5). Sending it to
      // Sonnet 4.5 / Haiku 4.5 returns a 400 and takes the whole turn down.
      ...(modelSupportsEffort(model) ? { output_config: { effort: this.effort } } : {}),
      ...(useThinking ? { thinking: { type: 'adaptive', display: 'summarized' } } : {}),
    } as Anthropic.MessageStreamParams);

    let text = '';
    let inThinking = false;
    let thinkingText = '';
    try {
      for await (const event of request) {
        const e = event as Anthropic.RawMessageStreamEvent;
        if (e.type === 'content_block_start') {
          inThinking = e.content_block?.type === 'thinking';
          thinkingText = '';
        } else if (e.type === 'content_block_stop') {
          if (inThinking && thinkingText) state.thinkingBlocks.push(thinkingText);
          inThinking = false;
          thinkingText = '';
        } else if (e.type === 'content_block_delta') {
          const d = e.delta as { type: string; thinking?: string; text?: string };
          if (inThinking && d.type === 'thinking_delta') {
            thinkingText += d.thinking ?? '';
          } else if (!inThinking && d.type === 'text_delta') {
            text += d.text ?? '';
            await stream.chunk(d.text ?? '');
          }
        }
      }
      return { message: await request.finalMessage(), text };
    } catch (err) {
      // This turn's text is already on screen: a retry/fallback would append a
      // second answer to it. Before any text, the caller may continue instead.
      if (text) throw new StreamInterruptedError(err);
      throw err;
    }
  }

  /** Compose the final text, publish DONE / AI_EMPTY_RESPONSE, maybe cache, return the trace. */
  private async finish(p: LoopRunParams, finalText: string, stopReason: string | null): Promise<AiTrace> {
    const { ctx, state, stream, model, startMs, resultSink } = p;
    const pendingActions = [...state.pendingActions.values()];
    let text = finalText;
    // A reply holding a confirmation card must reach DONE (that is where the
    // card is persisted) even when the model ended the turn without words.
    if (!text.trim() && !state.carriedText.trim() && pendingActions.length > 0) {
      text = ACTION_PENDING_FALLBACK_TEXT;
    }
    if (state.iteration >= MAX_ITER && !text && !state.carriedText) text = MAX_ITER_NOTICE;
    if (state.carriedText) text = text ? `${state.carriedText}\n${text}` : state.carriedText;
    if (resultSink) resultSink.fullContent = text;

    const trace: AiTrace = {
      thinkingBlocks: state.thinkingBlocks,
      toolCalls: state.toolCalls,
      inputTokens: state.usage.inputTokens,
      outputTokens: state.usage.outputTokens,
      cachedInputTokens: state.usage.cacheReadInputTokens,
      cacheCreationInputTokens: state.usage.cacheCreationInputTokens,
      thinkingTokens: Math.round(state.thinkingBlocks.join('').length / 4),
      processingMs: Date.now() - startMs,
      model,
      iterationCount: state.iteration,
    };
    if (state.usage.cacheReadInputTokens > 0) {
      this.logger.log(
        `Prompt cache hit for ${ctx.conversationId}: ${state.usage.cacheReadInputTokens} input tokens served from cache`,
      );
    }

    try {
      if (!text.trim()) {
        // A turn with no text (refusal, all tokens spent thinking): a blank DONE is
        // dropped by chat-service and the bubble just vanished. Say so instead.
        this.logger.warn(`Empty AI response (stop_reason=${stopReason}) for ${ctx.conversationId}`);
        await stream.error(
          AiStreamErrorCode.EMPTY_RESPONSE,
          'The AI returned an empty response.',
          stopReason ? { stopReason } : {},
        );
        return trace;
      }
      await stream.done({
        fullContent: text,
        sources: state.citations,
        trace,
        ...(pendingActions.length > 0 ? { pendingActions } : {}),
      });
    } catch (err) {
      // The answer was generated (and streamed): never let a publish failure
      // trigger a second generation on the fallback model.
      throw new StreamInterruptedError(err);
    }

    // Cache only DETERMINISTIC answers: no tool calls, no citable sources (KB or
    // web), no images, and nothing beyond the question (e.g. group context).
    if (
      ctx.responseCacheable !== false &&
      state.toolCalls.length === 0 &&
      state.citations.length === 0 &&
      !state.hasImages &&
      ctx.queryVector
    ) {
      await this.responseCache.store(ctx.conversationId, ctx.userId, ctx.queryVector, text);
    }
    return trace;
  }

  private async publishError(
    stream: AiReplyStream,
    code: AiStreamErrorCodeValue,
    message: string,
  ): Promise<void> {
    await stream
      .error(code, message)
      .catch((err) => this.logger.warn(`Could not publish ${code}: ${(err as Error).message}`));
  }

  /** System blocks: stable (cached) persona/contract + volatile grounding after it. */
  private buildSystemBlocks(ctx: RequestContext): Anthropic.TextBlockParam[] {
    const blocks: Anthropic.TextBlockParam[] = [
      {
        type: 'text',
        text: ctx.baseSystem,
        ...(this.promptCacheEnabled ? { cache_control: { type: 'ephemeral' as const } } : {}),
      },
    ];
    if (ctx.volatileSystem.trim()) {
      // Volatile content AFTER the cache breakpoint — does not bust the cache.
      blocks.push({ type: 'text', text: ctx.volatileSystem });
    }
    return blocks;
  }

  /**
   * Anthropic tool definitions with a cache breakpoint on the last tool. Only
   * name / description / input_schema are forwarded: internal metadata
   * (connector `sensitive` / `actionGroup`) never leaves ai-service.
   */
  private toAnthropicTools(defs: ToolDefinition[]): Anthropic.Tool[] {
    const tools = defs.map((d) => ({
      name: d.name,
      description: d.description,
      input_schema: d.input_schema,
    })) as Anthropic.Tool[];
    if (tools.length > 0 && this.promptCacheEnabled) {
      tools[tools.length - 1] = { ...tools[tools.length - 1], cache_control: { type: 'ephemeral' } };
    }
    return tools;
  }

  /**
   * Map history entries to Anthropic message params (TASK-10). Text turns map to
   * a plain string `content`. An image turn resolves its `imageUrls` to base64
   * image blocks placed BEFORE any caption text in the same user turn (per the
   * claude-api vision constraint). An image turn with no resolvable images and
   * no caption is dropped so we never send an empty `content` array.
   */
  private async buildHistoryMessages(history: AiHistoryEntry[]): Promise<Anthropic.MessageParam[]> {
    const out: Anthropic.MessageParam[] = [];
    for (const h of history) {
      if (h.type === 'image' && (h.imageUrls?.length ?? 0) > 0) {
        const imageBlocks = await this.chatImageService.resolveImageBlocks(h.imageUrls ?? []);
        const blocks: Anthropic.ContentBlockParam[] = [...imageBlocks];
        const caption = h.content?.trim();
        if (caption) blocks.push({ type: 'text', text: caption });
        if (blocks.length === 0) continue; // nothing usable — drop the turn
        out.push({ role: h.role, content: blocks });
      } else {
        // Drop turns with empty/blank text — the API rejects empty content.
        const text = h.content?.trim();
        if (!text) continue;
        out.push({ role: h.role, content: text });
      }
    }
    return out;
  }
}
