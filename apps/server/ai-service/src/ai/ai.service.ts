import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { RedisPublisherService } from '../redis/redis-publisher.service';

export interface AiRequestPayload {
  conversationId: string;
  userId: string;
  displayName: string;
  content: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;
  private readonly primaryModel: string;
  private readonly fallbackModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly publisher: RedisPublisherService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('config.anthropic.apiKey'),
    });
    this.primaryModel = this.configService.get<string>('config.anthropic.model') ?? 'claude-sonnet-4-5';
    this.fallbackModel =
      this.configService.get<string>('config.anthropic.fallbackModel') ?? 'claude-haiku-4-5-20251001';
  }

  async handleRequest(payload: AiRequestPayload): Promise<void> {
    const { conversationId, displayName, content, history } = payload;
    this.logger.log(`AI request for conversation ${conversationId} from ${displayName}`);

    const systemPrompt =
      `You are PON AI, an intelligent assistant embedded in the PON chat platform. ` +
      `You are helping ${displayName} in a conversation. ` +
      `Be helpful, concise, and friendly. Respond in the same language the user writes in. ` +
      `If you don't know something, say so clearly.`;

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content },
    ];

    let chunksPublished = false;
    try {
      chunksPublished = await this._streamWithModel(
        this.primaryModel, systemPrompt, messages, conversationId, false,
      );
    } catch (primaryError) {
      this.logger.error(
        `Primary model (${this.primaryModel}) failed for conversation ${conversationId}`,
        primaryError,
      );
      if (!chunksPublished) {
        try {
          await this._streamWithModel(
            this.fallbackModel, systemPrompt, messages, conversationId, true,
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
      } else {
        await this.publisher.publish(conversationId, {
          type: 'AI_STREAM_ERROR',
          error: 'AI is temporarily unavailable.',
        });
      }
    }
  }

  private async _streamWithModel(
    model: string,
    system: string,
    messages: Anthropic.MessageParam[],
    conversationId: string,
    isFallback: boolean,
  ): Promise<boolean> {
    let fullText = '';
    let chunksPublished = false;

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
        chunksPublished = true;
        await this.publisher.publish(conversationId, {
          type: 'AI_STREAM_CHUNK',
          chunk: chunk.delta.text,
        });
      }
    }

    await this.publisher.publish(conversationId, {
      type: 'AI_STREAM_DONE',
      fullContent: fullText,
    });

    if (isFallback) {
      this.logger.log(`Fallback model (${model}) succeeded for conversation ${conversationId}`);
    }
    return chunksPublished;
  }
}
