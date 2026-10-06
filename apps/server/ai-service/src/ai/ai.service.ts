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
import { FactExtractorService } from './fact-extractor.service';
import { ContextBuilderService } from './context-builder.service';
import { ResponseCacheService } from './response-cache.service';
import { SkillsService } from '../skills/skills.service';
import { buildSkillInstructions } from '../skills/skill-catalog';
import {
  ConversationAccessService,
  ConversationContext,
} from '../conversation/conversation-access.service';
import { EmbeddingService } from '../kb/embedding.service';
import { SettingsService } from '../settings/settings.service';
import { ResolvedAiSettings } from '../settings/resolved-ai-settings';
import { ChatImageService } from './chat-image.service';
import { AiSessionService } from '../session/ai-session.service';
import { CompactService } from '../session/compact.service';
import { currentTimeContext } from './current-time';
import { AgenticLoopService } from './agentic-loop.service';
import { AiReplyStream } from './ai-reply-stream';
import { LoopState } from './loop-state';
import { buildRecentConversationBlock } from './recent-conversation';
import {
  CACHE_TRACE,
  CONTEXT_COMPACTED_NOTICE,
  formatMemoryNotice,
  isMemoryCommand,
  NEW_SESSION_NOTICE,
  SYSTEM_TRACE,
} from './system-notices';
import { AiHistoryEntry, AiRequestPayload, AiTrace, RequestContext } from './ai.types';

// Re-exported so existing importers (`ai.consumer`, `fact-extractor`,
// `tracing-helpers`, the merge/normalize specs) keep their `./ai.service`
// import paths after the clean-code extraction.
export { AiHistoryEntry, AiRequestPayload, AiTrace } from './ai.types';
export { mergeSources, normalizeMessages } from './message-utils';

const UNAVAILABLE_MESSAGE = 'AI is temporarily unavailable.';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;
  private readonly primaryModel: string;
  private readonly fallbackModel: string;
  private readonly extractEveryTurns: number;
  private readonly timeZone: string;
  private readonly historyWindow: number;
  private readonly groupContextMessages: number;
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
    this.timeZone = this.configService.get<string>('config.ai.timeZone') ?? 'Asia/Ho_Chi_Minh';
    this.historyWindow = this.configService.get<number>('config.ai.historyWindow') ?? 20;
    this.groupContextMessages =
      this.configService.get<number>('config.ai.groupContextMessages') ?? 20;
    this.extractEveryTurns =
      this.configService.get<number>('config.memory.extractEveryTurns') ?? 20;
    const router = (key: string) => this.configService.get(`config.anthropic.router.${key}`);
    this.routerConfig = {
      enabled: (router('enabled') as boolean | undefined) ?? true,
      simpleModel: (router('simpleModel') as string | undefined) ?? 'claude-haiku-4-5',
      midModel: (router('midModel') as string | undefined) ?? 'claude-sonnet-4-6',
      complexModel: (router('complexModel') as string | undefined) ?? 'claude-opus-4-8',
      simpleMaxChars: (router('simpleMaxChars') as number | undefined) ?? 280,
      simpleMaxHistory: (router('simpleMaxHistory') as number | undefined) ?? 4,
      midMaxChars: (router('midMaxChars') as number | undefined) ?? 1200,
      midMaxHistory: (router('midMaxHistory') as number | undefined) ?? 20,
    };
  }

  /**
   * Whether a model accepts the `output_config.effort` parameter. Delegates to
   * the shared pure predicate in model-router (kept here so the effort-gating
   * regression test can assert against the service).
   */
  private modelSupportsEffort(model: string): boolean {
    return modelSupportsEffort(model);
  }

  /**
   * Entry point for one `ai.requests` message. Whatever goes wrong, the client
   * gets a terminal event: a failure before the model ran (Mongo down during
   * the session / compaction / persona / quota setup) used to throw without
   * publishing anything, and the pending AI bubble just vanished.
   */
  async handleRequest(payload: AiRequestPayload): Promise<void> {
    const stream = new AiReplyStream(this.publisher, payload.conversationId, payload.userId);
    try {
      await this.dispatch(payload, stream);
    } catch (err) {
      if (!stream.finished) {
        await stream
          .error(AiStreamErrorCode.UNAVAILABLE, UNAVAILABLE_MESSAGE)
          .catch((e) =>
            this.logger.warn(
              `Could not publish AI_STREAM_ERROR for ${payload.conversationId}: ${(e as Error).message}`,
            ),
          );
      }
      // Rethrow so the RabbitMQ message is dead-lettered (consumer nacks).
      throw err;
    }
  }

  private async dispatch(payload: AiRequestPayload, stream: AiReplyStream): Promise<void> {
    const { conversationId, userId } = payload;

    // Defense-in-depth: reject if the requester is definitively not a member of
    // the conversation (forged/replayed queue message). Fails open on unknown.
    // The same read tells whether this is a direct AI chat or a shared one.
    const conversation = await this.conversationAccess.getConversationContext(conversationId, userId);
    if (conversation.access === 'denied') {
      this.logger.warn(`Access denied: user ${userId} not a participant of ${conversationId}`);
      await stream.error(AiStreamErrorCode.FORBIDDEN, 'You do not have access to this conversation.');
      return; // expected condition — do NOT dead-letter.
    }

    // Explicit context reset (`/new`): deactivate the current session, start a
    // fresh one, confirm, and return WITHOUT calling Claude (not quota-gated).
    if (payload.content.trim() === '/new') {
      await this.aiSessionService.createNewSession(userId, conversationId);
      await this.publishSystemResponse(stream, NEW_SESSION_NOTICE);
      return;
    }

    // Memory inspection (`/memory`, `/ai-memory`): the REAL stored memory of the
    // REQUESTER (never another member's), not a model guess. Costs no tokens.
    if (isMemoryCommand(payload.content)) {
      const memory = await this.memoryService.getMemory(conversationId, userId);
      await this.publishSystemResponse(stream, formatMemoryNotice(memory));
      return;
    }

    // Resolve workspace AI settings once (cached) and thread through the request.
    const settings = await this.settingsService.getSettings();

    if (await this.usageService.isQuotaExceeded(userId, settings.monthlyTokenLimit)) {
      this.logger.warn(`Quota exceeded for user ${userId} in conversation ${conversationId}`);
      await stream.error(
        AiStreamErrorCode.QUOTA_EXCEEDED,
        'Monthly AI usage quota exceeded. Please contact your admin.',
      );
      return; // quota is an expected condition — do NOT dead-letter.
    }

    const decision = await this.rateLimiter.acquire(userId);
    if (!decision.allowed) {
      this.logger.warn(
        `Rate limit (${decision.reason}) hit for user ${userId} in conversation ${conversationId}`,
      );
      await stream.error(
        AiStreamErrorCode.RATE_LIMITED,
        decision.reason === 'concurrency'
          ? 'Too many AI requests in progress. Please wait for the current one to finish.'
          : 'You are sending requests too quickly. Please slow down and try again shortly.',
      );
      return; // expected condition — do NOT dead-letter.
    }

    // Release the concurrency slot no matter how processing ends (incl. rethrow).
    try {
      await this.processRequest(payload, settings, stream, conversation);
    } finally {
      await decision.release();
    }
  }

  /** Core pipeline: session → context → route → agentic loop → persist → memory. */
  private async processRequest(
    payload: AiRequestPayload,
    settings: ResolvedAiSettings,
    stream: AiReplyStream,
    conversation: ConversationContext,
  ): Promise<void> {
    const { conversationId, userId, displayName, content, departmentId } = payload;
    const startMs = Date.now();
    this.logger.log(`AI request for conversation ${conversationId} from ${displayName}`);

    // The session is the source of truth for the requester's own exchanges with
    // the AI. Auto-compact near the context limit, then take the last
    // `historyWindow` turns verbatim (older ones live on as the summary). The
    // current turn is persisted only AFTER a successful answer (an orphan user
    // turn would make two consecutive user turns → Anthropic 400 next time).
    let session = await this.aiSessionService.getOrCreateActiveSession(userId, conversationId);
    const { session: compactedSession, compacted } =
      await this.compactService.maybeCompact(session);
    session = compactedSession;
    if (compacted) {
      // Its own replyId: chat-service dedupes DONE per replyId, so sharing the
      // answer's id would make it drop the answer.
      await this.publishSystemResponse(
        new AiReplyStream(this.publisher, conversationId, userId),
        CONTEXT_COMPACTED_NOTICE,
      );
    }
    const sessionId = session._id.toString();
    const history = await this.aiSessionService.buildMessageHistory(session, this.historyWindow);

    const persona = await this.personaService.getPersona(conversationId);
    // @AI in a shared chat (group / human DM): the private session alone can't
    // see the group, so show the latest messages chat-service sent as a fenced,
    // attributed block. Direct AI chats already have that context in the session.
    const groupContext =
      conversation.directAi === false
        ? buildRecentConversationBlock(payload.history, {
            currentContent: content,
            requesterId: userId,
            requesterName: displayName,
            assistantName: persona?.name ?? settings.personaName ?? 'PON AI',
            maxMessages: this.groupContextMessages,
          })
        : '';
    // An answer grounded on the evolving group conversation is not reusable.
    const responseCacheable = !groupContext;

    // Embed the user message ONCE — reused for both RAG and memory retrieval.
    let queryVector: number[] | null = null;
    try {
      queryVector = await this.embeddingService.embedOne(content);
    } catch (err) {
      this.logger.warn(`Embedding user message failed for ${conversationId}`, err);
    }

    // Semantic response cache (opt-in): a near-identical question by the SAME
    // user in this conversation reuses a recent deterministic answer.
    if (queryVector && responseCacheable) {
      const cached = await this.responseCache.lookup(conversationId, userId, queryVector);
      if (cached) {
        await this.serveCachedAnswer(stream, sessionId, payload, cached);
        return;
      }
    }

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
      // tools. Fetch the raw ids once and derive both from them (one query).
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
      volatileSystem: [
        currentTimeContext(new Date(), this.timeZone),
        skillInstructions,
        volatileContext.text,
        groupContext,
      ]
        .filter((s) => s && s.trim())
        .join('\n\n'),
      ragSources: volatileContext.ragSources,
      queryVector,
      responseCacheable,
      settings,
      enabledSkillIds,
    };

    // Images are NOT persisted in the session, so image turns are still sourced
    // from the ephemeral payload.history and appended (vision across the window).
    const imageTurns: AiHistoryEntry[] = this.chatImageService.isEnabled()
      ? payload.history.filter((h) => h.type === 'image' && (h.imageUrls?.length ?? 0) > 0)
      : [];
    const loopHistory: AiHistoryEntry[] = [...history, ...imageTurns];
    const selectedModel = this.routeModel(content, loopHistory, ctx, settings, imageTurns.length > 0);

    // Captures the final assistant text so it can be appended to the session.
    const resultSink = { fullContent: '' };
    let state: LoopState | null = null;
    let trace: AiTrace | null = null;
    try {
      state = await this.agenticLoop.prepare(ctx, content, loopHistory);
      trace = await this.agenticLoop.runWithFallback({
        anthropic: this.anthropic,
        primaryModel: selectedModel,
        fallbackModel: this.fallbackModel,
        ctx,
        state,
        stream,
        startMs,
        resultSink,
      });
    } finally {
      // Every model call is billed whether or not the reply succeeded — record
      // what the loop consumed (incl. a failed primary) with the quota's totals.
      if (state) this.recordLoopUsage(userId, state, trace !== null && !!resultSink.fullContent.trim());
    }

    // Persist the user + assistant turns TOGETHER, and ONLY after a successful,
    // non-empty assistant turn (user first so auto-naming sees a user message).
    if (resultSink.fullContent.trim()) {
      try {
        await this.aiSessionService.appendMessage(sessionId, 'user', content);
        await this.aiSessionService.appendMessage(sessionId, 'assistant', resultSink.fullContent);
      } catch (err) {
        this.logger.warn(`Appending user/assistant turn pair failed for ${sessionId}`, err);
      }
    }

    try {
      const count = await this.memoryService.incrementMessageCount(conversationId, userId);
      // Extract facts: first after turn 3, then every extractEveryTurns turns.
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

  /** Router tier for this turn; image turns force the vision-capable primary model. */
  private routeModel(
    content: string,
    loopHistory: AiHistoryEntry[],
    ctx: RequestContext,
    settings: ResolvedAiSettings,
    hasImageTurn: boolean,
  ): string {
    const routeSignals: RouteSignals = {
      contentLength: content.length,
      historyLength: loopHistory.length,
      hasKbContext: ctx.ragSources.length > 0,
      // Workspace tier override (TASK-12); 'auto' ⇒ env router heuristics.
      forcedTier: settings.modelTier,
    };
    let selectedModel = selectModel(routeSignals, this.routerConfig);
    // TASK-10: the router's haiku/sonnet tiers must not receive image blocks
    // (vision support unconfirmed → would 400). Gated by chat vision.
    if (hasImageTurn && selectedModel !== this.primaryModel) {
      this.logger.log(
        `Forcing primary model ${this.primaryModel} (was ${selectedModel}) — image turn present`,
      );
      selectedModel = this.primaryModel;
    }
    this.logger.log(
      `Model routing: selected=${selectedModel} (contentLength=${routeSignals.contentLength}, ` +
        `historyLength=${routeSignals.historyLength}, hasKbContext=${routeSignals.hasKbContext}) ` +
        `for conversation ${ctx.conversationId}`,
    );
    return selectedModel;
  }

  /** Record the loop's tokens; `answered` ⇒ it also counts as one AI request. */
  private recordLoopUsage(userId: string, state: LoopState, answered: boolean): void {
    const usage = state.usage;
    if (usage.inputTokens === 0 && usage.outputTokens === 0 && !answered) return;
    this.usageService
      .recordUsage(userId, usage, { countRequest: answered })
      .catch((err) => this.logger.warn(`Usage tracking failed for ${userId}`, err));
  }

  /** Stream a cached answer as if freshly generated (model skipped), keeping the session consistent. */
  private async serveCachedAnswer(
    stream: AiReplyStream,
    sessionId: string,
    payload: AiRequestPayload,
    answer: string,
  ): Promise<void> {
    const { conversationId, userId, content } = payload;
    this.logger.log(`Serving cached answer for ${conversationId} (model skipped)`);
    await stream.chunk(answer);
    await stream.done({ fullContent: answer, sources: [], fromCache: true, trace: CACHE_TRACE });
    // A cache hit is still a turn: append BOTH turns (user first for auto-naming).
    try {
      await this.aiSessionService.appendMessage(sessionId, 'user', content);
      await this.aiSessionService.appendMessage(sessionId, 'assistant', answer);
    } catch (err) {
      this.logger.warn(`Appending cached turn pair failed for ${sessionId}`, err);
    }
    await this.memoryService
      .incrementMessageCount(conversationId, userId)
      .catch((err) => this.logger.warn(`message count failed for ${conversationId}`, err));
  }

  /**
   * Publish a system-authored notice (e.g. `/new` confirmation, compaction
   * notice) as an ordinary AI message. chat-service persists any non-blank
   * `fullContent` as an AI message.
   */
  private async publishSystemResponse(stream: AiReplyStream, text: string): Promise<void> {
    await stream.chunk(text);
    await stream.done({ fullContent: text, sources: [], trace: SYSTEM_TRACE });
  }
}
