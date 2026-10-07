import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { UsageService } from '../usage/usage.service';
import { LlmClientsService } from '../llm/llm-clients.service';

/**
 * Thin wrapper around the Anthropic SDK for cheap, non-streaming utility calls
 * that are ancillary to the main agentic loop: session auto-naming and context
 * compaction. Both run on the light model — OpenRouter when configured, else
 * Haiku (see LlmClientsService). Their tokens are recorded against the user
 * they serve (they used to be invisible to quota).
 */
@Injectable()
export class ClaudeClientService {
  private readonly logger = new Logger(ClaudeClientService.name);
  private readonly anthropic: Anthropic;
  private readonly haikuModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usageService?: UsageService,
    @Optional() private readonly llm?: LlmClientsService,
  ) {
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
  async generateTitle(firstMessage: string, userId?: string): Promise<string> {
    const trimmed = firstMessage.trim().slice(0, 2000);
    if (!trimmed) return 'New conversation';
    const response = await this.light({
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
    this.usageService?.recordModelCall(userId, response.usage, 'session-title');
    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const title = text.trim().replace(/^["']|["']$/g, '').slice(0, 80);
    return title || 'New conversation';
  }

  /** Summarize older conversation turns, preserving facts/decisions/context. */
  async summarize(conversationText: string, userId?: string): Promise<string> {
    const response = await this.light({
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
    this.usageService?.recordModelCall(userId, response.usage, 'compaction');
    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  }

  /** Light-model call: OpenRouter (falling back to Haiku) when wired, else Haiku. */
  private async light(
    params: Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>,
  ): Promise<Anthropic.Message> {
    if (this.llm) return (await this.llm.createLight(params)).message;
    return this.anthropic.messages.create({ ...params, model: this.haikuModel });
  }
}
