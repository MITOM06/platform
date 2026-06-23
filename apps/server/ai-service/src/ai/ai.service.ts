import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { MemoryService } from '../memory/memory.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { UsageService } from '../usage/usage.service';
import { RateLimiterService } from '../usage/rate-limiter.service';
import { PersonaService } from '../persona/persona.service';
import { ToolContext } from '../tools/tool.interface';
import { selectModel, RouteSignals, RouterConfig } from './model-router';
import { AiStreamErrorCode } from './ai-stream-error';
import { withAgenticLoopSpan } from './tracing-helpers';
import { isSensitiveTool } from './injection-guard';
import { FactExtractorService } from './fact-extractor.service';
import { ContextBuilderService, RagSource } from './context-builder.service';
import { ResponseCacheService } from './response-cache.service';
import { SkillsService } from '../skills/skills.service';
import { ConversationAccessService } from '../conversation/conversation-access.service';
import { EmbeddingService } from '../kb/embedding.service';
import { SettingsService } from '../settings/settings.service';
import { ResolvedAiSettings } from '../settings/resolved-ai-settings';
import { ChatImageService } from './chat-image.service';

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
}

interface ToolTraceEntry {
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

interface RequestContext {
  conversationId: string;
  userId: string;
  displayName: string;
  /** Owning department id (P6 group bot); scopes KB retrieval when present. */
  departmentId?: string;
  /** Stable, cacheable persona + grounding contract. */
  baseSystem: string;
  /** Volatile per-request grounding block (RAG + memory). Placed AFTER cache. */
  volatileSystem: string;
  ragSources: RagSource[];
  /** Embedded user query — used to populate the semantic response cache. */
  queryVector?: number[] | null;
  /** Resolved workspace AI settings (TASK-12) threaded into the loop. */
  settings: ResolvedAiSettings;
}

const MAX_ITER = 5;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;
  private readonly primaryModel: string;
  private readonly fallbackModel: string;
  private readonly effort: 'low' | 'medium' | 'high';
  private readonly extractEveryTurns: number;
  private readonly promptCacheEnabled: boolean;
  private readonly routerConfig: RouterConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly publisher: RedisPublisherService,
    private readonly memoryService: MemoryService,
    private readonly embeddingService: EmbeddingService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly usageService: UsageService,
    private readonly rateLimiter: RateLimiterService,
    private readonly personaService: PersonaService,
    private readonly factExtractor: FactExtractorService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly skillsService: SkillsService,
    private readonly responseCache: ResponseCacheService,
    private readonly conversationAccess: ConversationAccessService,
    private readonly settingsService: SettingsService,
    private readonly chatImageService: ChatImageService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('config.anthropic.apiKey'),
    });
    this.primaryModel =
      this.configService.get<string>('config.anthropic.model') ?? 'claude-opus-4-8';
    this.fallbackModel =
      this.configService.get<string>('config.anthropic.fallbackModel') ?? 'claude-haiku-4-5';
    this.effort =
      (this.configService.get<string>('config.anthropic.effort') as 'low' | 'medium' | 'high') ??
      'high';
    this.extractEveryTurns =
      this.configService.get<number>('config.memory.extractEveryTurns') ?? 20;
    this.promptCacheEnabled =
      this.configService.get<boolean>('config.cache.promptCacheEnabled') ?? true;
    this.routerConfig = {
      enabled: this.configService.get<boolean>('config.anthropic.router.enabled') ?? true,
      simpleModel:
        this.configService.get<string>('config.anthropic.router.simpleModel') ?? 'claude-haiku-4-5',
      midModel:
        this.configService.get<string>('config.anthropic.router.midModel') ?? 'claude-sonnet-4-6',
      complexModel:
        this.configService.get<string>('config.anthropic.router.complexModel') ??
        'claude-opus-4-8',
      simpleMaxChars:
        this.configService.get<number>('config.anthropic.router.simpleMaxChars') ?? 280,
      simpleMaxHistory:
        this.configService.get<number>('config.anthropic.router.simpleMaxHistory') ?? 4,
      midMaxChars:
        this.configService.get<number>('config.anthropic.router.midMaxChars') ?? 1200,
      midMaxHistory:
        this.configService.get<number>('config.anthropic.router.midMaxHistory') ?? 20,
    };
  }

  async handleRequest(payload: AiRequestPayload): Promise<void> {
    const { conversationId, userId } = payload;

    // Defense-in-depth: reject if the requester is definitively not a member of
    // the conversation (forged/replayed queue message). Fails open on unknown.
    const access = await this.conversationAccess.checkAccess(conversationId, userId);
    if (access === 'denied') {
      this.logger.warn(`Access denied: user ${userId} not a participant of ${conversationId}`);
      await this.publisher.publish(conversationId, {
        type: 'AI_STREAM_ERROR',
        code: AiStreamErrorCode.FORBIDDEN,
        error: 'You do not have access to this conversation.',
      });
      return; // expected condition — do NOT dead-letter.
    }

    // Resolve workspace AI settings once (cached) and thread through the request.
    const settings = await this.settingsService.getSettings();

    if (await this.usageService.isQuotaExceeded(userId, settings.monthlyTokenLimit)) {
      this.logger.warn(`Quota exceeded for user ${userId} in conversation ${conversationId}`);
      await this.publisher.publish(conversationId, {
        type: 'AI_STREAM_ERROR',
        code: AiStreamErrorCode.QUOTA_EXCEEDED,
        error: 'Monthly AI usage quota exceeded. Please contact your admin.',
      });
      return; // quota is an expected condition — do NOT dead-letter.
    }

    const decision = await this.rateLimiter.acquire(userId);
    if (!decision.allowed) {
      this.logger.warn(
        `Rate limit (${decision.reason}) hit for user ${userId} in conversation ${conversationId}`,
      );
      await this.publisher.publish(conversationId, {
        type: 'AI_STREAM_ERROR',
        code: AiStreamErrorCode.RATE_LIMITED,
        error:
          decision.reason === 'concurrency'
            ? 'Too many AI requests in progress. Please wait for the current one to finish.'
            : 'You are sending requests too quickly. Please slow down and try again shortly.',
      });
      return; // expected condition — do NOT dead-letter.
    }

    // Release the concurrency slot no matter how processing ends (incl. rethrow).
    try {
      await this.processRequest(payload, settings);
    } finally {
      await decision.release();
    }
  }

  /** Core pipeline: embed → persona → context → route → agentic loop → memory. */
  private async processRequest(
    payload: AiRequestPayload,
    settings: ResolvedAiSettings,
  ): Promise<void> {
    const { conversationId, userId, displayName, content, history, departmentId } = payload;
    const startMs = Date.now();
    this.logger.log(`AI request for conversation ${conversationId} from ${displayName}`);

    // Embed the user message ONCE — reused for both RAG and memory retrieval.
    let queryVector: number[] | null = null;
    try {
      queryVector = await this.embeddingService.embedOne(content);
    } catch (err) {
      this.logger.warn(`Embedding user message failed for ${conversationId}`, err);
    }

    // Semantic response cache (opt-in): a near-identical question in this same
    // conversation reuses a recent deterministic answer, skipping the model call.
    if (queryVector) {
      const cached = await this.responseCache.lookup(conversationId, queryVector);
      if (cached) {
        await this.streamCachedAnswer(conversationId, cached);
        await this.memoryService
          .incrementMessageCount(conversationId)
          .catch((err) => this.logger.warn(`message count failed for ${conversationId}`, err));
        return;
      }
    }

    const persona = await this.personaService.getPersona(conversationId);
    // Per-conversation persona stays highest precedence; workspace defaults
    // (TASK-12) fill missing name/tone before the hardcoded fallback.
    const baseSystem = this.personaService.buildSystemPrompt(persona, displayName, {
      personaName: settings.personaName,
      defaultTone: settings.defaultTone,
    });

    const [volatileContext, skillInstructions] = await Promise.all([
      this.contextBuilder.buildVolatileContext(
        conversationId,
        userId,
        queryVector,
        content,
        departmentId,
      ),
      // Enabled skills change how the assistant behaves; injected per-user after
      // the cached persona block so they never bust the prompt cache.
      this.skillsService.getEnabledSkillInstructions(userId),
    ]);

    const ctx: RequestContext = {
      conversationId,
      userId,
      displayName,
      departmentId,
      baseSystem,
      volatileSystem: [skillInstructions, volatileContext.text]
        .filter((s) => s && s.trim())
        .join('\n\n'),
      ragSources: volatileContext.ragSources,
      queryVector,
      settings,
    };

    const routeSignals: RouteSignals = {
      contentLength: content.length,
      historyLength: history.length,
      hasKbContext: ctx.ragSources.length > 0,
      // Workspace tier override (TASK-12); 'auto' ⇒ env router heuristics.
      forcedTier: settings.modelTier,
    };
    let selectedModel = selectModel(routeSignals, this.routerConfig);

    // TASK-10: if any history turn carries images, force the vision-capable
    // primary model — the router's haiku/sonnet tiers must not receive image
    // blocks (vision support unconfirmed → would 400). Gated by chat vision.
    const hasImageTurn =
      this.chatImageService.isEnabled() &&
      history.some((h) => h.type === 'image' && (h.imageUrls?.length ?? 0) > 0);
    if (hasImageTurn && selectedModel !== this.primaryModel) {
      this.logger.log(
        `Forcing primary model ${this.primaryModel} (was ${selectedModel}) — image turn present`,
      );
      selectedModel = this.primaryModel;
    }

    this.logger.log(
      `Model routing: selected=${selectedModel} ` +
        `(contentLength=${routeSignals.contentLength}, ` +
        `historyLength=${routeSignals.historyLength}, ` +
        `hasKbContext=${routeSignals.hasKbContext}) ` +
        `for conversation ${conversationId}`,
    );

    let trace: AiTrace | null = null;
    try {
      trace = await withAgenticLoopSpan(selectedModel, conversationId, () =>
        this._agenticLoop(selectedModel, ctx, content, history, startMs),
      );
    } catch (primaryError) {
      this.logger.error(
        `Model (${selectedModel}) failed for conversation ${conversationId}`,
        primaryError,
      );
      if (primaryError instanceof Error && primaryError.message === 'STREAM_ALREADY_STARTED') {
        this.logger.warn(
          `Primary model failed mid-stream. Aborting fallback for ${conversationId} to prevent UI glitch.`,
        );
        await this.publisher.publish(conversationId, {
          type: 'AI_STREAM_ERROR',
          code: AiStreamErrorCode.STREAM_INTERRUPTED,
          error: 'AI stream was interrupted. Please try again.',
        });
        throw primaryError;
      }
      try {
        trace = await withAgenticLoopSpan(this.fallbackModel, conversationId, () =>
          this._agenticLoop(this.fallbackModel, ctx, content, history, startMs),
        );
      } catch (fallbackError) {
        this.logger.error(
          `Fallback model (${this.fallbackModel}) also failed for conversation ${conversationId}`,
          fallbackError,
        );
        await this.publisher.publish(conversationId, {
          type: 'AI_STREAM_ERROR',
          code: AiStreamErrorCode.UNAVAILABLE,
          error: 'AI is temporarily unavailable.',
        });
        // Rethrow so the RabbitMQ message is dead-lettered (consumer nacks).
        throw fallbackError;
      }
    }

    if (trace) {
      this.usageService
        .recordUsage(userId, trace.inputTokens, trace.outputTokens)
        .catch((err) => this.logger.warn(`Usage tracking failed for ${conversationId}`, err));
    }

    try {
      const count = await this.memoryService.incrementMessageCount(conversationId);
      if (this.extractEveryTurns > 0 && count % this.extractEveryTurns === 0) {
        this.factExtractor.extractFacts(conversationId, userId, history, count).catch((err) => {
          this.logger.error(`Fact extraction failed for ${conversationId}`, err);
        });
      }
    } catch (err) {
      this.logger.error(`Failed to increment message count for ${conversationId}`, err);
    }
  }

  /** Stream a cached answer to the client as if freshly generated (model skipped). */
  private async streamCachedAnswer(conversationId: string, answer: string): Promise<void> {
    this.logger.log(`Serving cached answer for ${conversationId} (model skipped)`);
    await this.publisher.publish(conversationId, { type: 'AI_STREAM_CHUNK', chunk: answer });
    await this.publisher.publish(conversationId, {
      type: 'AI_STREAM_DONE',
      fullContent: answer,
      sources: [],
      fromCache: true,
      trace: {
        thinkingBlocks: [],
        toolCalls: [],
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        thinkingTokens: 0,
        processingMs: 0,
        model: 'cache',
        iterationCount: 0,
      },
    });
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
        out.push({ role: h.role, content: h.content });
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
  private async _agenticLoop(
    model: string,
    ctx: RequestContext,
    userContent: string,
    history: AiRequestPayload['history'],
    startMs: number,
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

    const messages: Anthropic.MessageParam[] = [
      ...(await this.buildHistoryMessages(history)),
      { role: 'user', content: userContent },
    ];

    let iteration = 0;
    let fullText = '';
    let streamStarted = false;
    // Whether the prompt context carries image content blocks (gates the
    // deterministic response cache — image-grounded answers are not reusable).
    const hasImages = messages.some(
      (m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'image'),
    );

    while (iteration < MAX_ITER) {
      const stream = this.anthropic.messages.stream({
        model,
        max_tokens: 4096,
        system,
        messages,
        tools,
        tool_choice: { type: 'auto' },
        output_config: { effort: this.effort },
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
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }

        messages.push({ role: 'assistant', content: finalMsg.content });
        messages.push({ role: 'user', content: toolResults });
        iteration++;
        // Discard any partial text emitted before a tool_use turn; the model
        // will produce the user-facing answer after tools resolve.
        fullText = '';
        continue;
      }

      // stop_reason is end_turn / max_tokens / stop_sequence — final answer done.
      break;
    }

    if (iteration >= MAX_ITER && !fullText) {
      fullText = 'I had trouble completing that action. Please try again.';
    }

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
