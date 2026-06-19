import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { MemoryService } from '../memory/memory.service';
import type { AiRequestPayload } from './ai.service';

/**
 * Periodic semantic fact extraction from conversation history.
 * Produces a short summary + discrete facts which MemoryService dedupes
 * (cosine) and embeds into the vector store, then rebuilds the canonical
 * Mongo list for client consumption.
 */
@Injectable()
export class FactExtractorService {
  private readonly logger = new Logger(FactExtractorService.name);
  private readonly anthropic: Anthropic;
  private readonly fallbackModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly memoryService: MemoryService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('config.anthropic.apiKey'),
    });
    this.fallbackModel =
      this.configService.get<string>('config.anthropic.fallbackModel') ?? 'claude-haiku-4-5';
  }

  async extractFacts(
    conversationId: string,
    userId: string,
    history: AiRequestPayload['history'],
    count: number,
  ): Promise<void> {
    const systemPrompt =
      `You are a memory assistant. Summarize the following conversation in 2-3 sentences ` +
      `focusing on what the user talked about and any important information they shared.\n` +
      `Then on a new line write: FACTS: followed by a JSON array of up to 5 short, ` +
      `self-contained fact strings about the user (each independently meaningful).\n` +
      `Only include facts the user actually stated; do not invent.\n` +
      `Example:\n` +
      `The user discussed their Flutter project and asked about Redis pub/sub.\n` +
      `FACTS: ["Works on a Flutter + Spring Boot project called PON", "Uses Redis for message queue"]`;

    const messages: Anthropic.MessageParam[] = history.slice(-20).map((h) => ({
      role: h.role,
      content: h.content,
    }));
    if (messages.length === 0) return;

    const response = await this.anthropic.messages.create({
      model: this.fallbackModel,
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
        const parsed: unknown = JSON.parse(factsMatch[1]);
        if (Array.isArray(parsed))
          keyFacts = parsed.filter((f): f is string => typeof f === 'string');
      } catch {
        keyFacts = [];
      }
    }

    const summary = text.replace(/FACTS:\s*\[[\s\S]*?\]/, '').trim();

    await this.memoryService.addFacts(conversationId, userId, keyFacts, summary, count);
    this.logger.log(`Memory facts updated for conversation ${conversationId} at ${count} turns`);
  }
}
