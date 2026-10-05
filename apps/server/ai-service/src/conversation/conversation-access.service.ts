import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './conversation.schema';

export type AccessResult = 'allowed' | 'denied' | 'unknown';

export interface ConversationContext {
  access: AccessResult;
  /**
   * true  = 1-1 chat with the built-in AI bot (same rule as chat-service's
   *         `isDirectAiConversation`: 2 participants, one is the bot);
   * false = any shared chat (group, human DM) where the AI is @mentioned;
   * null  = unknown (lookup failed / not found) — callers keep direct-chat behavior.
   */
  directAi: boolean | null;
}

const UNKNOWN: ConversationContext = { access: 'unknown', directAi: null };

/**
 * Defense-in-depth check that the requesting user is a participant of the
 * conversation before the AI processes their request. chat-service is the
 * primary authority; this guards against forged/replayed queue messages. The
 * same single read also tells whether this is a direct AI chat.
 *
 * Fails OPEN ('unknown') on lookup error or a not-found/malformed id, so a Mongo
 * hiccup never blocks the assistant — only a definitive non-membership is denied.
 */
@Injectable()
export class ConversationAccessService {
  private readonly logger = new Logger(ConversationAccessService.name);
  private readonly botUserId: string;

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    configService?: ConfigService,
  ) {
    this.botUserId =
      configService?.get<string>('config.bot.userId') ?? 'ai-bot-000000000000000000000001';
  }

  async getConversationContext(
    conversationId: string,
    userId: string,
  ): Promise<ConversationContext> {
    if (!Types.ObjectId.isValid(conversationId)) return UNKNOWN;
    try {
      const convo = await this.conversationModel
        .findById(conversationId)
        .select('participants')
        .lean()
        .exec();
      if (!convo) return UNKNOWN;
      const participants = convo.participants ?? [];
      // Empty participants list = can't assert membership → don't block.
      if (participants.length === 0) return UNKNOWN;
      return {
        access: participants.includes(userId) ? 'allowed' : 'denied',
        directAi: participants.length === 2 && participants.includes(this.botUserId),
      };
    } catch (err) {
      this.logger.warn(`Conversation access check failed for ${conversationId}: ${(err as Error).message}`);
      return UNKNOWN;
    }
  }

  async checkAccess(conversationId: string, userId: string): Promise<AccessResult> {
    return (await this.getConversationContext(conversationId, userId)).access;
  }
}
