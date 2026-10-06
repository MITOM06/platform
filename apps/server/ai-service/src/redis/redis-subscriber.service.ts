import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_SUBSCRIBER } from './redis.constants';
import { KbProcessorService } from '../kb/kb-processor.service';
import { VectorStoreService } from '../kb/vector-store.service';
import { MemoryService } from '../memory/memory.service';

export const KB_PROCESS_CHANNEL = 'kb:process';
export const KB_DELETE_CHANNEL = 'kb:delete';
/**
 * chat-service publishes `{conversationId, userId}` here after a user deleted
 * their AI memory of a conversation (it deletes the Mongo doc itself). Without
 * this the delete was cosmetic: the fact vectors stayed in Qdrant and the AI kept
 * recalling them.
 */
export const AI_MEMORY_DELETE_CHANNEL = 'ai:memory:delete';

// ai:request is consumed via RabbitMQ (AiConsumer). This subscriber handles the
// knowledge-base lifecycle and memory-delete events, which use Redis pub/sub.
@Injectable()
export class RedisSubscriberService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedisSubscriberService.name);

  private readonly kbCollection: string;

  constructor(
    @Inject(REDIS_SUBSCRIBER) private readonly client: Redis,
    private readonly kbProcessor: KbProcessorService,
    private readonly vectorStore: VectorStoreService,
    private readonly configService: ConfigService,
    private readonly memoryService: MemoryService,
  ) {
    this.kbCollection =
      this.configService.get<string>('config.kb.qdrantCollection') ?? 'knowledge';
  }

  async onApplicationBootstrap(): Promise<void> {
    const channels = [KB_PROCESS_CHANNEL, KB_DELETE_CHANNEL, AI_MEMORY_DELETE_CHANNEL];
    try {
      await this.client.subscribe(...channels);
      this.logger.log(`Subscribed to Redis channels: ${channels.join(', ')}`);
    } catch (err) {
      this.logger.error(`Failed to subscribe to Redis channels: ${(err as Error).message}`);
    }

    this.client.on('message', (channel: string, message: string) => this.onMessage(channel, message));
  }

  /** Routes one pub/sub message. Never throws (a bad payload must not kill the listener). */
  onMessage(channel: string, message: string): void {
    if (channel === KB_PROCESS_CHANNEL) {
      try {
        const payload = JSON.parse(message);
        this.kbProcessor.processDocument(payload).catch((err) => {
          this.logger.error('Failed to process kb:process message', err);
        });
      } catch (err) {
        this.logger.error('Failed to parse kb:process message', err);
      }
      return;
    }

    if (channel === KB_DELETE_CHANNEL) {
      try {
        const { documentId } = JSON.parse(message);
        this.vectorStore.deleteDocument(this.kbCollection, documentId).catch((err) => {
          this.logger.error(`Failed to delete vectors for document ${documentId}`, err);
        });
      } catch (err) {
        this.logger.error('Failed to parse kb:delete message', err);
      }
      return;
    }

    if (channel === AI_MEMORY_DELETE_CHANNEL) {
      this.handleMemoryDelete(message);
    }
  }

  private handleMemoryDelete(message: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      this.logger.warn(`Ignoring malformed ${AI_MEMORY_DELETE_CHANNEL} message`);
      return;
    }
    const { conversationId, userId } = (parsed ?? {}) as Record<string, unknown>;
    if (typeof conversationId !== 'string' || !conversationId.trim()) {
      this.logger.warn(`Ignoring ${AI_MEMORY_DELETE_CHANNEL} message without conversationId`);
      return;
    }
    // userId is REQUIRED: deleting by conversation alone would erase every
    // member's memory of a shared group.
    if (typeof userId !== 'string' || !userId.trim()) {
      this.logger.warn(`Ignoring ${AI_MEMORY_DELETE_CHANNEL} message without userId`);
      return;
    }
    this.memoryService
      .forgetConversation(conversationId, userId)
      .then((ok) => {
        if (ok) this.logger.log(`Forgot memory of user ${userId} in conversation ${conversationId}`);
        else this.logger.warn(`Memory vectors of user ${userId} in ${conversationId} were not deleted`);
      })
      .catch((err) =>
        this.logger.error(`Memory delete failed for user ${userId} in ${conversationId}`, err),
      );
  }
}
