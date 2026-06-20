import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { MemoryService } from '../memory/memory.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { UsageService } from '../usage/usage.service';
import { PersonaService } from '../persona/persona.service';
import { ToolContext } from '../tools/tool.interface';
import { selectModel, RouteSignals, RouterConfig } from './model-router';
import { AiStreamErrorCode } from './ai-stream-error';
import { withAgenticLoopSpan } from './tracing-helpers';
import { FactExtractorService } from './fact-extractor.service';
import { ContextBuilderService } from './context-builder.service';
import { EmbeddingService } from '../kb/embedding.service';

export interface AiRequestPayload {
  conversationId: string;
  userId: string;
  displayName: string;
  content: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Owning department id of the conversation (P6 group bot); null for personal. */
  departmentId?: string;
}

interface RagSource {
  documentId: string;
  score: number;
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
  private readonly routerConfig: RouterConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly publisher: RedisPublisherService,
    private readonly memoryService: MemoryService,
    private readonly embeddingService: EmbeddingService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly usageService: UsageService,
    private readonly personaService: PersonaService,
    private readonly factExtractor: FactExtractorService,
    private readonly contextBuilder: ContextBuilderService,
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
    const { conversationId, userId, displayName, content, history, departmentId } =
      payload;

    if (await this.usageService.isQuotaExceeded(userId)) {
      this.logger.warn(`Quota exceeded for user ${userId} in conversation ${conversationId}`);
      await this.publisher.publish(conversationId, {
        type: 'AI_STREAM_ERROR',
        code: AiStreamErrorCode.QUOTA_EXCEEDED,
        error: 'Monthly AI usage quota exceeded. Please contact your admin.',
      });
      return; // quota is an expected condition — do NOT dead-letter.
    }

    const startMs = Date.now();
    this.logger.log(`AI request for conversation ${conversationId} from ${displayName}`);

    // Embed the user message ONCE — reused for both RAG and memory retrieval.
    let queryVector: number[] | null = null;
    try {
      queryVector = await this.embeddingService.embedOne(content);
    } catch (err) {
      this.logger.warn(`Embedding user message failed for ${conversationId}`, err);
    }

    const persona = await this.personaService.getPersona(conversationId);
    const baseSystem = this.personaService.buildSystemPrompt(persona, displayName);

    const volatileContext = await this.contextBuilder.buildVolatileContext(
      conversationId,
      userId,
      queryVector,
      departmentId,
    );

    const ctx: RequestContext = {
      conversationId,
      userId,
      displayName,
      departmentId,
      baseSystem,
      volatileSystem: volatileContext.text,
      ragSources: volatileContext.ragSources,
    };

    const routeSignals: RouteSignals = {
      contentLength: content.length,
      historyLength: history.length,
      hasKbContext: ctx.ragSources.length > 0,
    };
    const selectedModel = selectModel(routeSignals, this.routerConfig);
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

  /** System blocks: stable (cached) persona/contract + volatile grounding after it. */
  private buildSystemBlocks(ctx: RequestContext): Anthropic.TextBlockParam[] {
    const blocks: Anthropic.TextBlockParam[] = [
      {
        type: 'text',
        text: ctx.baseSystem,
        cache_control: { type: 'ephemeral' },
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
    if (tools.length > 0) {
      tools[tools.length - 1] = {
        ...tools[tools.length - 1],
        cache_control: { type: 'ephemeral' },
      };
    }
    return tools;
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
    const enableThinking = this.configService.get<boolean>('config.ai.enableThinking') ?? false;
    // Adaptive thinking only on the primary model (Opus 4.8 / Sonnet 4.6).
    const useThinking = enableThinking && model === this.primaryModel;
    const thinkingParam: { thinking?: Anthropic.ThinkingConfigParam } = useThinking
      ? { thinking: { type: 'adaptive', display: 'summarized' } }
      : {};

    const system = this.buildSystemBlocks(ctx);
    const toolCtx: ToolContext = {
      conversationId: ctx.conversationId,
      userId: ctx.userId,
      displayName: ctx.displayName,
      departmentId: ctx.departmentId,
    };
    const tools = await this.buildTools(toolCtx);

    const toolCalls: ToolTraceEntry[] = [];
    const thinkingBlocks: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent },
    ];

    let iteration = 0;
    let fullText = '';
    let streamStarted = false;

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

      if (finalMsg.stop_reason === 'tool_use') {
        const toolUseBlocks = finalMsg.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          const inputSummary = JSON.stringify(block.input).slice(0, 100);
          await this.publisher.publish(ctx.conversationId, {
            type: 'AI_TOOL_CALL',
            toolName: block.name,
            inputSummary,
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
      thinkingTokens: Math.round(thinkingBlocks.join('').length / 4),
      processingMs: Date.now() - startMs,
      model,
      iterationCount: iteration,
    };

    await this.publisher.publish(ctx.conversationId, {
      type: 'AI_STREAM_DONE',
      fullContent: fullText,
      sources: ctx.ragSources,
      trace,
    });

    return trace;
  }
}
