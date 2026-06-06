import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiMemory, AiMemoryDocument } from './ai-memory.schema';

@Injectable()
export class MemoryService {
  constructor(
    @InjectModel(AiMemory.name) private readonly memoryModel: Model<AiMemoryDocument>,
  ) {}

  async getMemory(conversationId: string): Promise<AiMemory | null> {
    return this.memoryModel.findOne({ conversationId }).lean().exec() as Promise<AiMemory | null>;
  }

  async upsertMemory(
    conversationId: string,
    userId: string,
    summary: string,
    keyFacts: string[],
    messageCount: number,
  ): Promise<void> {
    await this.memoryModel.findOneAndUpdate(
      { conversationId },
      { $set: { userId, summary, keyFacts, messageCount, updatedAt: new Date() } },
      { upsert: true, new: true },
    );
  }

  async deleteMemory(conversationId: string): Promise<void> {
    await this.memoryModel.deleteOne({ conversationId });
  }

  async incrementMessageCount(conversationId: string): Promise<number> {
    const result = await this.memoryModel.findOneAndUpdate(
      { conversationId },
      { $inc: { messageCount: 1 } },
      { upsert: true, new: true },
    );
    return result?.messageCount ?? 1;
  }
}
