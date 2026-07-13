import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { MemoryService } from '../memory/memory.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { UsageService } from '../usage/usage.service';
import { RateLimiterService } from '../usage/rate-limiter.service';
import { PersonaService } from '../persona/persona.service';
import { selectModel, RouteSignals, RouterConfig, modelSupportsEffort } from './model-router';
import { AiStreamErrorCode } from './ai-stream-error';
import { withAgenticLoopSpan } from './tracing-helpers';
import { FactExtractorService } from './fact-extractor.service';
import { ContextBuilderService } from './context-builder.service';
import { ResponseCacheService } from './response-cache.service';
import { SkillsService } from '../skills/skills.service';
import { buildSkillInstructions } from '../skills/skill-catalog';
import { ConversationAccessService } from '../conversation/conversation-access.service';
import { EmbeddingService } from '../kb/embedding.service';
import { SettingsService } from '../settings/settings.service';
import { ResolvedAiSettings } from '../settings/resolved-ai-settings';
import { ChatImageService } from './chat-image.service';
import { AiSessionService } from '../session/ai-session.service';
import { CompactService } from '../session/compact.service';
import { AgenticLoopService } from './agentic-loop.service';
import {
  AiHistoryEntry,
  AiRequestPayload,
  AiTrace,
  RequestContext,
} from './ai.types';

// Re-exported so existing importers (`ai.consumer`, `fact-extractor`,
// `tracing-helpers`, the merge/normalize specs) keep their `./ai.service`
// import paths after the clean-code extraction.
export { AiHistoryEntry, AiRequestPayload, AiTrace } from './ai.types';
export { mergeSources, normalizeMessages } from './message-utils';

/**
 * User-facing notices published as ordinary AI messages (reusing the Redis
 * stream mechanism). Backend-authored text — the plan's primary deployment
 * language is Vietnamese; the web/mobile i18n keys mirror these strings.
 */
const NEW_SESSION_NOTICE =
  '✅ Đã bắt đầu cuộc trò chuyện mới. Cuộc trò chuyện trước đó đã được lưu lại và có thể tiếp tục sau.';
const CONTEXT_COMPACTED_NOTICE =
  '🗜️ Ngữ cảnh đã được tóm tắt để tối ưu bộ nhớ. Lịch sử đầy đủ vẫn được lưu trong phiên trò chuyện.';
const MEMORY_EMPTY_NOTICE =
  '🧠 Tôi chưa ghi nhớ điều gì về bạn. Hãy chat thêm một chút để tôi học được về bạn.';

/** A zeroed trace for system-authored (non-model) stream responses. */
const SYSTEM_TRACE: AiTrace = {
  thinkingBlocks: [],
  toolCalls: [],
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  thinkingTokens: 0,
  processingMs: 0,
  model: 'system',
  iterationCount: 0,
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;
  private readonly primaryModel: string;
  private readonly fallbackModel: string;
  private readonly extractEveryTurns: number;
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
    private readonly aiSessionService: AiSessionService,
    private readonly compactService: CompactService,
    private readonly agenticLoop: AgenticLoopService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('config.anthropic.apiKey'),
    });
    this.primaryModel =
      this.configService.get<string>('config.anthropic.model') ?? 'claude-opus-4-8';
    this.fallbackModel =
      this.configService.get<string>('config.anthropic.fallbackModel') ?? 'claude-haiku-4-5';
    this.extractEveryTurns =
      this.configService.get<number>('config.memory.extractEveryTurns') ?? 20;
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

  /**
   * Whether a model accepts the `output_config.effort` parameter. Delegates to
   * the shared pure predicate in model-router (kept here so the effort-gating
   * regression test can assert against the service). See the exported
   * `modelSupportsEffort` for the full per-model rationale.
   */
  private modelSupportsEffort(model: string): boolean {
    return modelSupportsEffort(model);
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

    // Explicit context reset (`/new`): deactivate the current session, start a
    // fresh one, confirm to the user, and return WITHOUT calling Claude. Not
    // gated by quota/rate limits — it is not a model call.
    if (payload.content.trim() === '/new') {
      await this.aiSessionService.createNewSession(userId, conversationId);
      await this.publishSystemResponse(conversationId, NEW_SESSION_NOTICE);
      return;
    }

    // Memory inspection (`/memory`, `/ai-memory`): return the REAL stored memory
    // from the DB rather than letting Claude hallucinate it from history. System
    // response — not gated by quota/rate limits, costs no tokens.
    const trimmedContent = payload.content.trim();
    if (trimmedContent === '/memory' || trimmedContent === '/ai-memory') {
      const memory = await this.memoryService.getMemory(conversationId);
      if (!memory || (!memory.summary && memory.keyFacts.length === 0)) {
        await this.publishSystemResponse(conversationId, MEMORY_EMPTY_NOTICE);
      } else {
        const factsText =
          memory.keyFacts.length > 0
            ? '\n\n**Thông tin đã ghi nhớ:**\n' +
              memory.keyFacts.map((f) => `• ${f}`).join('\n')
            : '';
        const notice =
          `🧠 **Những gì tôi đã ghi nhớ về bạn (${memory.messageCount} tin nhắn):**\n\n` +
          `${memory.summary}` +
          factsText;
        await this.publishSystemResponse(conversationId, notice);
      }
      return;
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
    const { conversationId, userId, displayName, content, departmentId } = payload;
    const startMs = Date.now();
    this.logger.log(`AI request for conversation ${conversationId} from ${displayName}`);

    // Session is the AI-layer source of truth for textual history (not
    // payload.history). Resolve the active session, auto-compact if it is near
    // the context limit, then snapshot the PRIOR turns before the current one is
    // appended — the agentic loop adds the current message as the final turn.
    let session = await this.aiSessionService.getOrCreateActiveSession(userId, conversationId);
    const { session: compactedSession, compacted } =
      await this.compactService.maybeCompact(session);
    session = compactedSession;
    if (compacted) {
      await this.publishSystemResponse(conversationId, CONTEXT_COMPACTED_NOTICE);
    }
    const sessionId = session._id.toString();
    const history = await this.aiSessionService.buildMessageHistory(session);
    // NOTE: the current user turn is intentionally NOT persisted here. It is
    // persisted TOGETHER with the assistant turn only AFTER the agentic loop
    // succeeds (see below). Persisting it up-front would leave an orphan `user`
    // turn if both the primary and fallback models fail (→ two consecutive
    // `user` turns next request → Anthropic 400 → session bricked until `/new`).
    // The current message still reaches Claude exactly once via the loop's
    // `userContent` argument; `history` was snapshot before this point.

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
        // Keep the session consistent — a cache hit is still a turn in history.
        // Append BOTH the user turn and the cached assistant turn (the user turn
        // is not persisted earlier — see the note above). User first so
        // auto-naming still fires on the first message.
        await this.aiSessionService.appendMessage(sessionId, 'user', content);
        await this.aiSessionService.appendMessage(sessionId, 'assistant', cached);
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

    const [volatileContext, enabledSkillIds] = await Promise.all([
      this.contextBuilder.buildVolatileContext(
        conversationId,
        userId,
        queryVector,
        content,
        departmentId,
        { perms: payload.perms ?? [], departmentIds: payload.departmentIds ?? [], role: payload.role },
      ),
      // Enabled skills change how the assistant behaves AND gate action-skill MCP
      // tools (skill-tool wiring). Fetch the raw ids once and derive both the
      // system-prompt instruction block and the tool gate from them (one query).
      this.skillsService.getEnabledSkillIds(userId),
    ]);
    // Injected per-user after the cached persona block so they never bust the cache.
    const skillInstructions = buildSkillInstructions(enabledSkillIds);

    const ctx: RequestContext = {
      conversationId,
      userId,
      displayName,
      departmentId,
      role: payload.role,
      perms: payload.perms ?? [],
      departmentIds: payload.departmentIds ?? [],
      baseSystem,
      volatileSystem: [skillInstructions, volatileContext.text]
        .filter((s) => s && s.trim())
        .join('\n\n'),
      ragSources: volatileContext.ragSources,
      queryVector,
      settings,
      enabledSkillIds,
    };

    // Text history is the session (source of truth). Images are NOT persisted in
    // the session, so image turns are still sourced from the ephemeral RabbitMQ
    // payload.history and appended — vision keeps working across the window while
    // text continuity comes from the session (compaction / `/new` aware).
    const imageTurns: AiHistoryEntry[] = this.chatImageService.isEnabled()
      ? payload.history.filter((h) => h.type === 'image' && (h.imageUrls?.length ?? 0) > 0)
      : [];
    const loopHistory: AiHistoryEntry[] = [...history, ...imageTurns];

    const routeSignals: RouteSignals = {
      contentLength: content.length,
      historyLength: loopHistory.length,
      hasKbContext: ctx.ragSources.length > 0,
      // Workspace tier override (TASK-12); 'auto' ⇒ env router heuristics.
      forcedTier: settings.modelTier,
    };
    let selectedModel = selectModel(routeSignals, this.routerConfig);

    // TASK-10: if any history turn carries images, force the vision-capable
    // primary model — the router's haiku/sonnet tiers must not receive image
    // blocks (vision support unconfirmed → would 400). Gated by chat vision.
    const hasImageTurn = imageTurns.length > 0;
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

    // Captures the final assistant text so it can be appended to the session
    // after the (streaming) loop completes on either the primary or fallback model.
    const resultSink = { fullContent: '' };
    let trace: AiTrace | null = null;
    try {
      trace = await withAgenticLoopSpan(selectedModel, conversationId, () =>
        this.agenticLoop.run(
          this.anthropic,
          selectedModel,
          ctx,
          content,
          loopHistory,
          startMs,
          resultSink,
        ),
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
          this.agenticLoop.run(
            this.anthropic,
            this.fallbackModel,
            ctx,
            content,
            loopHistory,
            startMs,
            resultSink,
          ),
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

    // Persist the user + assistant turns TOGETHER, and ONLY after a successful
    // assistant turn (non-empty). Appending the user turn earlier would leave an
    // orphan `user` turn on model failure (→ two consecutive user turns next
    // request → Anthropic 400). Order matters: the user turn is appended first so
    // auto-naming (which fires on the first message) still sees a user message.
    if (resultSink.fullContent.trim()) {
      try {
        await this.aiSessionService.appendMessage(sessionId, 'user', content);
        await this.aiSessionService.appendMessage(sessionId, 'assistant', resultSink.fullContent);
      } catch (err) {
        this.logger.warn(`Appending user/assistant turn pair failed for ${sessionId}`, err);
      }
    }

    try {
      const count = await this.memoryService.incrementMessageCount(conversationId);
      // Extract facts:
      //   - First time: after turn 3 (enough context, but don't wait too long)
      //   - Periodically: every extractEveryTurns thereafter (default 10, not 20)
      const isFirstExtraction = count === 3;
      const isPeriodicExtraction =
        this.extractEveryTurns > 0 && count > 3 && count % this.extractEveryTurns === 0;
      if (isFirstExtraction || isPeriodicExtraction) {
        this.factExtractor.extractFacts(conversationId, userId, loopHistory, count).catch((err) => {
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

  /**
   * Publish a system-authored notice (e.g. `/new` confirmation, compaction
   * notice) as an ordinary AI message via the existing Redis stream mechanism.
   * chat-service persists any non-blank `fullContent` as an AI message.
   */
  private async publishSystemResponse(conversationId: string, text: string): Promise<void> {
    await this.publisher.publish(conversationId, { type: 'AI_STREAM_CHUNK', chunk: text });
    await this.publisher.publish(conversationId, {
      type: 'AI_STREAM_DONE',
      fullContent: text,
      sources: [],
      trace: SYSTEM_TRACE,
    });
  }
}
