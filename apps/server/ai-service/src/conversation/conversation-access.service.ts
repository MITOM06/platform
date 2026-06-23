import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from './conversation.schema';

export type AccessResult = 'allowed' | 'denied' | 'unknown';

/**
 * Defense-in-depth check that the requesting user is a participant of the
 * conversation before the AI processes their request. chat-service is the
 * primary authority; this guards against forged/replayed queue messages.
 *
 * Fails OPEN ('unknown') on lookup error or a not-found/malformed id, so a Mongo
 * hiccup never blocks the assistant — only a definitive non-membership is denied.
 */
@Injectable()
export class ConversationAccessService {
  private readonly logger = new Logger(ConversationAccessService.name);

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  async checkAccess(conversationId: string, userId: string): Promise<AccessResult> {
    if (!Types.ObjectId.isValid(conversationId)) return 'unknown';
    try {
      const convo = await this.conversationModel
        .findById(conversationId)
        .select('participants')
        .lean()
        .exec();
      if (!convo) return 'unknown';
      const participants = convo.participants ?? [];
      // Empty participants list = can't assert membership → don't block.
      if (participants.length === 0) return 'unknown';
      return participants.includes(userId) ? 'allowed' : 'denied';
    } catch (err) {
      this.logger.warn(`Conversation access check failed for ${conversationId}: ${(err as Error).message}`);
      return 'unknown';
    }
  }
}
