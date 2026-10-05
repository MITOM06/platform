import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { PersonaService } from '../persona/persona.service';
import { SettingsService } from '../settings/settings.service';
import { UsageService } from '../usage/usage.service';
import { AiSessionService } from '../session/ai-session.service';
import { AiReplyStream } from '../ai/ai-reply-stream';
import { AiTrace } from '../ai/ai.types';
import { countTokens, TokenCounts, zeroTokens } from '../usage/token-counts';
import { buildFollowUpPrompt, followUpNotice } from './action-follow-up.prompt';
import { ActionOutcome, PendingActionRecord } from './pending-action.types';

const MAX_FOLLOW_UP_TOKENS = 300;

/**
 * Posts the short AI reply that reports a confirmed action's outcome: a NEW
 * reply (own replyId) through the normal `ai:response:{conversationId}` stream,
 * so chat-service persists and broadcasts it like any AI message. Uses the
 * conversation persona and the cheap router tier; the call's tokens count
 * against the requester like any other reply. When the model is unavailable,
 * over quota or silent, a fixed notice is posted instead — the user always
 * learns the outcome. Never throws.
 */
@Injectable()
export class ActionFollowUpService {
  private readonly logger = new Logger(ActionFollowUpService.name);
  private readonly anthropic: Anthropic;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly publisher: RedisPublisherService,
    private readonly personaService: PersonaService,
    private readonly settingsService: SettingsService,
    private readonly usageService: UsageService,
    private readonly aiSessionService: AiSessionService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('config.anthropic.apiKey'),
    });
    this.model =
      this.configService.get<string>('config.anthropic.router.simpleModel') ??
      this.configService.get<string>('config.anthropic.fallbackModel') ??
      'claude-haiku-4-5';
  }

  async post(record: PendingActionRecord, outcome: ActionOutcome): Promise<void> {
    const startMs = Date.now();
    const stream = new AiReplyStream(this.publisher, record.conversationId, record.userId);
    const generated = await this.generate(record, outcome);
    const text = generated.text || followUpNotice(outcome);
    const trace: AiTrace = {
      thinkingBlocks: [],
      toolCalls: [
        {
          toolName: record.toolName,
          inputSummary: JSON.stringify(record.input).slice(0, 100),
          resultSummary: outcome.result.slice(0, 200),
        },
      ],
      inputTokens: generated.usage.inputTokens,
      outputTokens: generated.usage.outputTokens,
      cachedInputTokens: generated.usage.cacheReadInputTokens,
      cacheCreationInputTokens: generated.usage.cacheCreationInputTokens,
      thinkingTokens: 0,
      processingMs: Date.now() - startMs,
      model: generated.text ? this.model : 'system',
      iterationCount: 0,
    };
    try {
      await stream.chunk(text);
      await stream.done({ fullContent: text, sources: [], trace });
    } catch (err) {
      this.logger.error(
        `Could not publish the follow-up for action ${record.id}: ${(err as Error).message}`,
      );
      return;
    }
    await this.rememberInSession(record, text);
  }

  /** One persona-aware model call; '' when skipped (quota) or failed. */
  private async generate(
    record: PendingActionRecord,
    outcome: ActionOutcome,
  ): Promise<{ text: string; usage: TokenCounts }> {
    let usage = zeroTokens();
    let text = '';
    try {
      const settings = await this.settingsService.getSettings();
      if (await this.usageService.isQuotaExceeded(record.userId, settings.monthlyTokenLimit)) {
        this.logger.warn(`Quota exceeded — fixed follow-up for action ${record.id}`);
        return { text, usage };
      }
      const persona = await this.personaService.getPersona(record.conversationId);
      const system = this.personaService.buildSystemPrompt(persona, record.displayName, {
        personaName: settings.personaName,
        defaultTone: settings.defaultTone,
      });
      const res = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: MAX_FOLLOW_UP_TOKENS,
        system,
        messages: [{ role: 'user', content: buildFollowUpPrompt(record, outcome) }],
      });
      usage = countTokens(res.usage);
      text = (res.content ?? [])
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
    } catch (err) {
      this.logger.warn(`Follow-up model call failed for action ${record.id}: ${(err as Error).message}`);
    }
    if (usage.inputTokens > 0 || usage.outputTokens > 0) {
      this.usageService
        .recordUsage(record.userId, usage, { countRequest: !!text })
        .catch((err) => this.logger.warn(`Usage tracking failed for ${record.userId}`, err));
    }
    return { text, usage };
  }

  /** So the next turn knows the action ran (the pending reply only said it was waiting). */
  private async rememberInSession(record: PendingActionRecord, text: string): Promise<void> {
    try {
      const session = await this.aiSessionService.getOrCreateActiveSession(
        record.userId,
        record.conversationId,
      );
      await this.aiSessionService.appendMessage(session._id.toString(), 'assistant', text);
    } catch (err) {
      this.logger.warn(`Could not add the follow-up of action ${record.id} to the session`, err);
    }
  }
}
