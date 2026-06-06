import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { MemoryService } from '../memory/memory.service';
import { KbProcessorService } from '../kb/kb-processor.service';
import { EmbeddingService } from '../kb/embedding.service';
import { VectorStoreService } from '../kb/vector-store.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ToolContext } from '../tools/tool.interface';

export interface AiRequestPayload {
  conversationId: string;
  userId: string;
  displayName: string;
  content: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
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

const MAX_ITER = 5;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;
  private readonly primaryModel: string;
  private readonly fallbackModel: string;
  private readonly qdrantCollection: string;
  private readonly topK: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly publisher: RedisPublisherService,
    private readonly memoryService: MemoryService,
    private readonly kbProcessor: KbProcessorService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStore: VectorStoreService,
    private readonly toolRegistry: ToolRegistryService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('config.anthropic.apiKey'),
    });
    this.primaryModel =
      this.configService.get<string>('config.anthropic.model') ?? 'claude-sonnet-4-5';
    this.fallbackModel =
      this.configService.get<string>('config.anthropic.fallbackModel') ??
      'claude-haiku-4-5-20251001';
    this.qdrantCollection =
      this.configService.get<string>('config.kb.qdrantCollection') ?? 'knowledge';
    this.topK = this.configService.get<number>('config.kb.topK') ?? 4;
  }

  async handleRequest(payload: AiRequestPayload): Promise<void> {
    const { conversationId, userId, displayName, content, history } = payload;
    this.logger.log(`AI request for conversation ${conversationId} from ${displayName}`);

    // AI-2.4: Fetch long-term memory
    const memory = await this.memoryService.getMemory(conversationId);

    let systemPrompt =
      `You are PON AI, an intelligent assistant embedded in the PON chat platform. ` +
      `You are helping ${displayName} in a conversation. ` +
      `Be helpful, concise, and friendly. Respond in the same language the user writes in. ` +
      `If you don't know something, say so clearly.`;

    if (memory && memory.summary) {
      systemPrompt += `\n\n## Memory from previous conversations:\n${memory.summary}`;
      if (memory.keyFacts && memory.keyFacts.length > 0) {
        systemPrompt +=
          `\n\nKey facts about this user:\n` +
          memory.keyFacts.map((f) => `- ${f}`).join('\n');
      }
    }

    // AI-3.6: Inject RAG context
    const ragSources: RagSource[] = [];
    try {
      const docIds = await this.kbProcessor.getReadyDocumentIds(conversationId);
      if (docIds.length > 0) {
        const queryVector = await this.embeddingService.embedOne(content);
        const results = await this.vectorStore.search(
          this.qdrantCollection,
          queryVector,
          this.topK,
          docIds,
        );
        const relevant = results.filter((r) => r.score > 0.3);
        if (relevant.length > 0) {
          relevant.forEach((r) => ragSources.push({ documentId: r.documentId, score: r.score }));
          const contextBlock =
            `\n\n## Relevant Knowledge Base Context:\n` +
            relevant.map((r, i) => `[Source ${i + 1}] ${r.text}`).join('\n\n') +
            `\nUse the above context to answer the user's question. Cite sources as [Source N] inline.`;
          systemPrompt += contextBlock;
        }
      }
    } catch (err) {
      this.logger.warn(
        `RAG context fetch failed for ${conversationId}, proceeding without context`,
        err,
      );
    }

    try {
      await this._agenticLoop(
        this.primaryModel, systemPrompt, content, history, conversationId, userId, displayName, ragSources,
      );
    } catch (primaryError) {
      this.logger.error(
        `Primary model (${this.primaryModel}) failed for conversation ${conversationId}`,
        primaryError,
      );
      try {
        await this._agenticLoop(
          this.fallbackModel, systemPrompt, content, history, conversationId, userId, displayName, ragSources,
        );
      } catch (fallbackError) {
        this.logger.error(
          `Fallback model (${this.fallbackModel}) also failed for conversation ${conversationId}`,
          fallbackError,
        );
        await this.publisher.publish(conversationId, {
          type: 'AI_STREAM_ERROR',
          error: 'AI is temporarily unavailable.',
        });
      }
    }

    // AI-2.3: Increment message count and trigger summarization every 20 turns
    try {
      const count = await this.memoryService.incrementMessageCount(conversationId);
      if (count % 20 === 0) {
        this._generateSummary(conversationId, userId, history, count).catch((err) => {
          this.logger.error(`Summary generation failed for ${conversationId}`, err);
        });
      }
    } catch (err) {
      this.logger.error(`Failed to increment message count for ${conversationId}`, err);
    }
  }

  private async _agenticLoop(
    model: string,
    system: string,
    userContent: string,
    history: AiRequestPayload['history'],
    conversationId: string,
    userId: string,
    displayName: string,
    ragSources: RagSource[],
  ): Promise<void> {
    const tools = this.toolRegistry.getDefinitions();
    const ctx: ToolContext = { conversationId, userId, displayName };
    const toolTrace: ToolTraceEntry[] = [];

    let messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent },
    ];

    let iteration = 0;
    let lastTextContent = '';

    while (iteration < MAX_ITER) {
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 4096,
        system,
        messages,
        tools: tools as Anthropic.Tool[],
        tool_choice: { type: 'auto' },
      });

      // Capture any text in the response for fallback
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      if (textBlocks.length > 0) {
        lastTextContent = textBlocks.map((b) => b.text).join('');
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          const inputSummary = JSON.stringify(block.input).slice(0, 100);
          await this.publisher.publish(conversationId, {
            type: 'AI_TOOL_CALL',
            toolName: block.name,
            inputSummary,
          });

          const result = await this.toolRegistry.execute(
            block.name,
            block.input as Record<string, unknown>,
            ctx,
          );
          toolTrace.push({
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

        messages = [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        ];
        iteration++;
        continue;
      }

      // stop_reason === 'end_turn' — stream the final text response
      break;
    }

    // If MAX_ITER exhausted without end_turn, publish what we have
    if (iteration >= MAX_ITER) {
      const fallback =
        lastTextContent ||
        "I had trouble completing that action. Please try again.";
      await this.publisher.publish(conversationId, {
        type: 'AI_STREAM_DONE',
        fullContent: fallback,
        sources: ragSources,
        toolTrace,
      });
      return;
    }

    // Stream the final answer
    let fullText = '';
    const stream = this.anthropic.messages.stream({
      model,
      max_tokens: 2048,
      system,
      messages,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        fullText += chunk.delta.text;
        await this.publisher.publish(conversationId, {
          type: 'AI_STREAM_CHUNK',
          chunk: chunk.delta.text,
        });
      }
    }

    await this.publisher.publish(conversationId, {
      type: 'AI_STREAM_DONE',
      fullContent: fullText,
      sources: ragSources,
      toolTrace,
    });
  }

  private async _generateSummary(
    conversationId: string,
    userId: string,
    history: AiRequestPayload['history'],
    count: number,
  ): Promise<void> {
    const systemPrompt =
      `You are a memory assistant. Summarize the following conversation in 2-3 sentences ` +
      `focusing on what the user talked about and any important information they shared.\n` +
      `Then on a new line write: FACTS: followed by a JSON array of up to 5 short fact strings about the user.\n` +
      `Example format:\n` +
      `The user discussed their Flutter project and asked about Redis pub/sub architecture.\n` +
      `FACTS: ["Works on a Flutter + Spring Boot project called PON", "Uses Redis for message queue", "Interested in AI integration"]`;

    const messages: Anthropic.MessageParam[] = history.slice(-20).map((h) => ({
      role: h.role,
      content: h.content,
    }));

    if (messages.length === 0) return;

    const response = await this.anthropic.messages.create({
      model: this.primaryModel,
      max_tokens: 512,
      system: systemPrompt,
      messages,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const factsMatch = text.match(/FACTS:\s*(\[[\s\S]*?\])/);
    let keyFacts: string[] = [];
    if (factsMatch) {
      try {
        keyFacts = JSON.parse(factsMatch[1]);
      } catch {
        keyFacts = [];
      }
    }

    const summary = text.replace(/FACTS:\s*\[[\s\S]*?\]/, '').trim();

    await this.memoryService.upsertMemory(conversationId, userId, summary, keyFacts, count);
    this.logger.log(`Memory summary updated for conversation ${conversationId} at ${count} turns`);
  }
}
