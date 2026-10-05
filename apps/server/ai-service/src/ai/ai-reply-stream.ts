import { randomUUID } from 'node:crypto';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { AiStreamErrorCodeValue } from './ai-stream-error';
import { RagSource } from './rag-source.type';
import { AiTrace } from './ai.types';

export interface AiStreamDonePayload {
  fullContent: string;
  sources: RagSource[];
  trace: AiTrace | null;
  fromCache?: boolean;
}

/**
 * One AI reply on `ai:response:{conversationId}`.
 *
 * Every event it publishes (`AI_STREAM_CHUNK`, `AI_TOOL_CALL`, `AI_STREAM_DONE`,
 * `AI_STREAM_ERROR`) carries `replyId` (unique per reply) and `requesterId` (the
 * user who asked). Without them two @AI requests in one group streamed into one
 * bubble, and one user's quota error cleared another user's stream. chat-service
 * also keys its multi-instance DONE claim on `replyId`, so every separately
 * persisted message (e.g. a compaction notice before the answer) needs its own
 * stream.
 *
 * Tracks whether a terminal event went out, so the request's last-resort error
 * handler publishes `AI_STREAM_ERROR` only when the client got nothing final.
 */
export class AiReplyStream {
  private terminal = false;

  constructor(
    private readonly publisher: RedisPublisherService,
    readonly conversationId: string,
    readonly requesterId: string,
    readonly replyId: string = randomUUID(),
  ) {}

  /** True once DONE or ERROR was published for this reply. */
  get finished(): boolean {
    return this.terminal;
  }

  async chunk(text: string): Promise<void> {
    await this.emit({ type: 'AI_STREAM_CHUNK', chunk: text });
  }

  async toolCall(toolName: string, inputSummary: string, sensitive: boolean): Promise<void> {
    await this.emit({ type: 'AI_TOOL_CALL', toolName, inputSummary, sensitive });
  }

  async done(payload: AiStreamDonePayload): Promise<void> {
    await this.emit({ type: 'AI_STREAM_DONE', ...payload });
    this.terminal = true;
  }

  async error(
    code: AiStreamErrorCodeValue,
    message: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.emit({ type: 'AI_STREAM_ERROR', code, error: message, ...extra });
    this.terminal = true;
  }

  private emit(payload: Record<string, unknown>): Promise<void> {
    return this.publisher.publish(this.conversationId, {
      ...payload,
      replyId: this.replyId,
      requesterId: this.requesterId,
    });
  }
}
