import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { MemoryService } from '../memory/memory.service';
import type { AiRequestPayload } from './ai.service';
/**
 * The last 20 turns as ONE user message holding a plain transcript. Sending them
 * as real user/assistant turns broke extraction twice over: an image turn is an
 * empty user message (400 "non-empty content"), and history usually ENDS with an
 * assistant reply, which the API treats as a prefill to continue — the model
 * carried on chatting instead of answering, so no FACTS line was ever produced.
 */
export function toExtractionMessages(
  history: AiRequestPayload['history'],
): Anthropic.MessageParam[] {
  const lines: string[] = [];
  for (const h of history.slice(-20)) {
    const text = (h.content ?? '').trim();
    const content = h.type === 'image' ? (text ? `[image] ${text}` : '[image]') : text;
    if (content) lines.push(`${h.role === 'user' ? 'User' : 'Assistant'}: ${content}`);
  }
  if (!lines.some((l) => l.startsWith('User: '))) return [];
  return [
    {
      role: 'user',
      content: `Conversation transcript:\n\n${lines.join('\n\n')}\n\nSummarize it and list the FACTS as instructed.`,
    },
  ];
}

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
      // English facts for a Vietnamese user showed up untranslated on the memory
      // screen and never deduped against facts saved in Vietnamese.
      `Write the summary and every fact in the same language the user writes in.\n` +
      `Example:\n` +
      `The user discussed their Flutter project and asked about Redis pub/sub.\n` +
      `FACTS: ["Works on a Flutter + Spring Boot project called PON", "Uses Redis for message queue"]`;

    const messages = toExtractionMessages(history);
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
