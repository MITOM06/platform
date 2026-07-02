import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Thin wrapper around the Anthropic SDK for cheap, non-streaming utility calls
 * that are ancillary to the main agentic loop: session auto-naming and context
 * compaction. Uses the Haiku model (cheapest / fastest) for both.
 */
@Injectable()
export class ClaudeClientService {
  private readonly logger = new Logger(ClaudeClientService.name);
  private readonly anthropic: Anthropic;
  private readonly haikuModel: string;

  constructor(private readonly configService: ConfigService) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('config.anthropic.apiKey'),
    });
    // Fallback model in this deployment is Haiku; reuse it as the cheap utility
    // model. Overridable via ANTHROPIC_FALLBACK_MODEL.
    this.haikuModel =
      this.configService.get<string>('config.anthropic.fallbackModel') ??
      'claude-haiku-4-5-20251001';
  }

  /** Generate a short (5-8 word) session title from the first user message. */
  async generateTitle(firstMessage: string): Promise<string> {
    const trimmed = firstMessage.trim().slice(0, 2000);
    if (!trimmed) return 'New conversation';
    const response = await this.anthropic.messages.create({
      model: this.haikuModel,
      max_tokens: 32,
      messages: [
        {
          role: 'user',
          content:
            'Generate a concise conversation title (5-8 words, no quotes, no ' +
            'trailing punctuation) in the same language as the message below. ' +
            'Reply with ONLY the title.\n\n' +
            trimmed,
        },
      ],
    });
    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const title = text.trim().replace(/^["']|["']$/g, '').slice(0, 80);
    return title || 'New conversation';
  }

  /** Summarize older conversation turns, preserving facts/decisions/context. */
  async summarize(conversationText: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: this.haikuModel,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content:
            'Summarize this conversation concisely, preserving key facts, ' +
            'decisions, and context that would be needed to continue the ' +
            'conversation. Respond in the same language as the conversation:\n\n' +
            conversationText,
        },
      ],
    });
    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  }
}
