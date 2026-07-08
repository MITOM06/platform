import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ResponseCacheService } from './response-cache.service';
import { ChatImageService } from './chat-image.service';
import { ToolContext } from '../tools/tool.interface';
import { RagSource } from './rag-source.type';
import { modelSupportsEffort } from './model-router';
import { isSensitiveTool, wrapUntrusted } from './injection-guard';
import { mergeSources, normalizeMessages } from './message-utils';
import { AiHistoryEntry, AiTrace, RequestContext, ToolTraceEntry } from './ai.types';

const MAX_ITER = 5;

/**
 * Runs a single streaming agentic loop against Anthropic: streams text deltas to
 * Redis; when a turn stops with `tool_use`, runs the tools, appends the results,
 * and continues the SAME loop. Extracted from AiService (clean-code 500-line
 * limit) with identical behavior — the Anthropic client is passed in by the
 * caller so per-request model/fallback selection and test overrides still apply.
 */
@Injectable()
export class AgenticLoopService {
  private readonly logger = new Logger(AgenticLoopService.name);
  private readonly primaryModel: string;
  private readonly effort: 'low' | 'medium' | 'high';
  private readonly promptCacheEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly publisher: RedisPublisherService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly responseCache: ResponseCacheService,
    private readonly chatImageService: ChatImageService,
  ) {
    this.primaryModel =
      this.configService.get<string>('config.anthropic.model') ?? 'claude-opus-4-8';
    this.effort =
      (this.configService.get<string>('config.anthropic.effort') as 'low' | 'medium' | 'high') ??
      'high';
    this.promptCacheEnabled =
      this.configService.get<boolean>('config.cache.promptCacheEnabled') ?? true;
  }

  /** System blocks: stable (cached) persona/contract + volatile grounding after it. */
  private buildSystemBlocks(ctx: RequestContext): Anthropic.TextBlockParam[] {
    const blocks: Anthropic.TextBlockParam[] = [
      {
        type: 'text',
        text: ctx.baseSystem,
        ...(this.promptCacheEnabled
          ? { cache_control: { type: 'ephemeral' as const } }
          : {}),
      },
    ];
    if (ctx.volatileSystem.trim()) {
      // Volatile content AFTER the cache breakpoint — does not bust the cache.
      blocks.push({ type: 'text', text: ctx.volatileSystem });
    }
    return blocks;
  }

  /** Tool definitions with a cache breakpoint on the last tool. */
  private async buildTools(ctx: ToolContext): Promise<Anthropic.Tool[]> {
    const defs = await this.toolRegistry.getDefinitions(ctx);
    const tools = defs.map((d) => ({
      name: d.name,
      description: d.description,
      input_schema: d.input_schema,
    })) as Anthropic.Tool[];
    if (tools.length > 0 && this.promptCacheEnabled) {
      tools[tools.length - 1] = {
        ...tools[tools.length - 1],
        cache_control: { type: 'ephemeral' },
      };
    }
    return tools;
  }

  /**
   * Map history entries to Anthropic message params (TASK-10). Text turns map to
   * a plain string `content` (byte-identical to before). An image turn resolves
   * its `imageUrls` to base64 image blocks placed BEFORE any caption text in the
   * same user turn (per the claude-api vision constraint). If image resolution
   * yields nothing (disabled / all skipped) the turn degrades to text — and an
   * image turn with empty caption + no resolvable images is dropped entirely so
   * we never send an empty `content` array.
   */
  private async buildHistoryMessages(
    history: AiHistoryEntry[],
  ): Promise<Anthropic.MessageParam[]> {
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
        // Drop turns with empty/blank text — the Anthropic API rejects empty
        // content, and a blank history turn carries no signal anyway.
        const text = h.content?.trim();
        if (!text) continue;
        out.push({ role: h.role, content: text });
      }
    }
    return out;
  }

  /**
   * Single streaming agentic loop. Streams text deltas to Redis; when the turn
   * stops with `tool_use`, runs the tools, appends results, and continues the
   * SAME loop. The final assistant turn is streamed natively — no blind second
   * call. Usage is counted once per API call (no double counting).
   */
  async run(
    anthropic: Anthropic,
    model: string,
    ctx: RequestContext,
    userContent: string,
    history: AiHistoryEntry[],
    startMs: number,
    resultSink?: { fullContent: string },
  ): Promise<AiTrace> {
    // Workspace thinking toggle (TASK-12) — already resolved against the env
    // default (AI_ENABLE_THINKING) by SettingsService.
    const enableThinking = ctx.settings.thinkingEnabled;
    // Adaptive thinking only on the primary model (Opus 4.8 / Sonnet 4.6).
    const useThinking = enableThinking && model === this.primaryModel;
    const thinkingParam: { thinking?: Anthropic.ThinkingConfigParam } = useThinking
      ? { thinking: { type: 'adaptive', display: 'summarized' } }
      : {};

    const system = this.buildSystemBlocks(ctx);
    // Per-request sink for tool-produced citable sources (e.g. web_search). Tools
    // push RagSource entries here inside the loop; merged into AI_STREAM_DONE below.
    const sourceSink: RagSource[] = [];
    const toolCtx: ToolContext = {
      conversationId: ctx.conversationId,
      userId: ctx.userId,
      displayName: ctx.displayName,
      departmentId: ctx.departmentId,
      sourceSink,
      // Workspace tool governance (TASK-12): web-search toggle + AI connector
      // allow-list. The registry composes these with the provider gate / the
      // workspace-wide allow-list already enforced by connector-service.
      webSearchEnabled: ctx.settings.webSearchEnabled,
      allowedConnectors: ctx.settings.allowedConnectors,
    };
    const tools = await this.buildTools(toolCtx);

    const toolCalls: ToolTraceEntry[] = [];
    const thinkingBlocks: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedTokens = 0;

    // Single chokepoint for the final messages array. normalizeMessages drops a
    // leading assistant turn (array must start with `user`) and merges
    // consecutive same-role PLAIN-TEXT turns (defense for the orphan-user and
    // summary-priming bugs → no two consecutive same-role turns → no Anthropic
    // 400). Image/multimodal turns (block-array content) are never merged, so
    // vision turns reach Claude intact and still force the vision model.
    const messages: Anthropic.MessageParam[] = normalizeMessages([
      ...(await this.buildHistoryMessages(history)),
      { role: 'user', content: userContent },
    ]);

    let iteration = 0;
    let fullText = '';
    // Text the model streamed BEFORE issuing a tool_use turn. It was already
    // sent to the client as AI_STREAM_CHUNK, so it must survive into the final
    // persisted message — otherwise the live view and the stored message
    // diverge. Accumulated across tool iterations and prepended to the final
    // answer below.
    let carriedText = '';
    let streamStarted = false;
    // Whether the prompt context carries image content blocks (gates the
    // deterministic response cache — image-grounded answers are not reusable).
    const hasImages = messages.some(
      (m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'image'),
    );

    while (iteration < MAX_ITER) {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 4096,
        system,
        messages,
        tools,
        tool_choice: { type: 'auto' },
        // `output_config.effort` is only accepted by effort-capable models
        // (Opus 4.5+, Sonnet 4.6+, Sonnet 5, Fable/Mythos 5). Sending it to
        // Sonnet 4.5 / Haiku 4.5 returns a 400 and takes the whole turn down.
        ...(modelSupportsEffort(model) ? { output_config: { effort: this.effort } } : {}),
        ...thinkingParam,
      } as Anthropic.MessageStreamParams);

      let isInThinkingBlock = false;
      let currentThinkingText = '';

      try {
        for await (const event of stream) {
          const e = event as Anthropic.RawMessageStreamEvent;
          if (e.type === 'content_block_start') {
            isInThinkingBlock = e.content_block?.type === 'thinking';
            currentThinkingText = '';
          } else if (e.type === 'content_block_stop') {
            if (isInThinkingBlock && currentThinkingText) {
              thinkingBlocks.push(currentThinkingText);
            }
            isInThinkingBlock = false;
            currentThinkingText = '';
          } else if (e.type === 'content_block_delta') {
            const d = e.delta as { type: string; thinking?: string; text?: string };
            if (isInThinkingBlock && d.type === 'thinking_delta') {
              currentThinkingText += d.thinking ?? '';
            } else if (!isInThinkingBlock && d.type === 'text_delta') {
              streamStarted = true;
              fullText += d.text ?? '';
              await this.publisher.publish(ctx.conversationId, {
                type: 'AI_STREAM_CHUNK',
                chunk: d.text ?? '',
              });
            }
          }
        }
      } catch (err) {
        if (streamStarted) throw new Error('STREAM_ALREADY_STARTED');
        throw err;
      }

      const finalMsg = await stream.finalMessage();
      // Count usage ONCE per API call.
      totalInputTokens += finalMsg.usage.input_tokens;
      totalOutputTokens += finalMsg.usage.output_tokens;
      // Tokens served from the prompt cache (read) — the savings indicator.
      totalCachedTokens += finalMsg.usage.cache_read_input_tokens ?? 0;

      if (finalMsg.stop_reason === 'tool_use') {
        const toolUseBlocks = finalMsg.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          const inputSummary = JSON.stringify(block.input).slice(0, 100);
          // Flag state-changing / outbound tools so the client can surface a
          // confirmation affordance before the action is shown as done.
          await this.publisher.publish(ctx.conversationId, {
            type: 'AI_TOOL_CALL',
            toolName: block.name,
            inputSummary,
            sensitive: isSensitiveTool(block.name),
          });
          const result = await this.toolRegistry.execute(
            block.name,
            block.input as Record<string, unknown>,
            toolCtx,
          );
          toolCalls.push({
            toolName: block.name,
            inputSummary,
            resultSummary: result.slice(0, 200),
          });
          // Fence tool output as UNTRUSTED before it re-enters the model
          // context (indirect prompt-injection surface): a connector/MCP tool
          // can return attacker-controlled text (an email body, a doc, an issue
          // comment). web_search already wraps its own output at source
          // (web-search.tool.ts) — don't double-wrap it. Fall back to the raw
          // string when wrapping yields '' (empty result) so we never send an
          // empty tool_result content.
          const fencedResult =
            block.name === 'web_search'
              ? result
              : wrapUntrusted(`Tool Result: ${block.name}`, result) || result;
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: fencedResult,
          });
        }

        messages.push({ role: 'assistant', content: finalMsg.content });
        messages.push({ role: 'user', content: toolResults });
        iteration++;
        // Keep any text streamed before this tool_use turn (it already reached
        // the client). Accumulate it, newline-separated, then reset fullText so
        // the next iteration streams the post-tool answer cleanly.
        if (fullText.trim()) {
          carriedText = carriedText ? `${carriedText}\n${fullText}` : fullText;
        }
        fullText = '';
        continue;
      }

      // stop_reason is end_turn / max_tokens / stop_sequence — final answer done.
      break;
    }

    if (iteration >= MAX_ITER && !fullText && !carriedText) {
      fullText = 'I had trouble completing that action. Please try again.';
    }

    // Prepend the pre-tool-call text that was already streamed to the client so
    // AI_STREAM_DONE.fullContent (and the persisted message) match the live view.
    if (carriedText) {
      fullText = fullText ? `${carriedText}\n${fullText}` : carriedText;
    }

    // Expose the final assistant text so processRequest can persist it to the
    // session (the loop streams natively, so the caller can't read fullText).
    if (resultSink) resultSink.fullContent = fullText;

    const trace: AiTrace = {
      thinkingBlocks,
      toolCalls,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cachedInputTokens: totalCachedTokens,
      thinkingTokens: Math.round(thinkingBlocks.join('').length / 4),
      processingMs: Date.now() - startMs,
      model,
      iterationCount: iteration,
    };

    if (totalCachedTokens > 0) {
      this.logger.log(
        `Prompt cache hit for ${ctx.conversationId}: ${totalCachedTokens} input tokens served from cache`,
      );
    }

    await this.publisher.publish(ctx.conversationId, {
      type: 'AI_STREAM_DONE',
      fullContent: fullText,
      // RAG sources first, then tool-produced (web) sources — contiguous order so
      // the [Source N] markers the model emitted line up with the merged array.
      sources: mergeSources(ctx.ragSources, sourceSink),
      trace,
    });

    // Cache only DETERMINISTIC answers: no tool calls (external/non-deterministic),
    // no RAG sources (context-dependent), no web sources (time-sensitive), and no
    // images (the answer is grounded on attached pixels, not the text query alone).
    if (
      toolCalls.length === 0 &&
      ctx.ragSources.length === 0 &&
      sourceSink.length === 0 &&
      !hasImages &&
      ctx.queryVector &&
      fullText.trim()
    ) {
      await this.responseCache.store(ctx.conversationId, ctx.queryVector, fullText);
    }

    return trace;
  }
}
