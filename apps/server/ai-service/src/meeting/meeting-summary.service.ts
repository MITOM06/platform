import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import Redis from 'ioredis';
import { REDIS_PUBLISHER } from '../redis/redis.constants';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { UsageService } from '../usage/usage.service';
import { MeetingRecordClient } from './meeting-record.client';
import { MEETING_SYSTEM_PROMPT, parseMeetingSummary, renderMeetingPrompt } from './meeting-prompt';
import {
  MEETING_SUMMARY_RESULT_CHANNEL,
  MeetingSummarizeMessage,
  MeetingSummary,
  MeetingSummaryStatus,
} from './meeting.constants';

@Injectable()
export class MeetingSummaryService {
  private readonly logger = new Logger(MeetingSummaryService.name);
  private readonly anthropic: Anthropic;
  private readonly model: string;
  /** Workspace feature: tokens go on the bot user, not a member's quota. */
  private readonly botUserId: string;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly redis: Redis,
    private readonly publisher: RedisPublisherService,
    private readonly configService: ConfigService,
    private readonly recordClient: MeetingRecordClient,
    private readonly usageService?: UsageService,
  ) {
    this.anthropic = new Anthropic({ apiKey: this.configService.get<string>('config.anthropic.apiKey') });
    this.model = this.configService.get<string>('config.anthropic.model') ?? 'claude-opus-4-8';
    this.botUserId =
      this.configService.get<string>('config.bot.userId') ?? 'ai-bot-000000000000000000000001';
  }

  /** Summarize a finished meeting and publish `meet:summary:result` (ok | empty | failed). */
  async summarize(msg: MeetingSummarizeMessage): Promise<void> {
    const { meetingId, attempt, requesterId } = msg;
    // pub/sub reaches every instance: only the claimant does the work.
    const claimed = await this.redis.set(
      `meet:summarize:claim:${meetingId}:${attempt}`, '1', 'EX', 3600, 'NX',
    );
    if (claimed !== 'OK') return;

    try {
      const view = await this.recordClient.fetch(meetingId, requesterId);
      if (!view) return await this.publish(msg, 'failed');

      const empty =
        view.records.length === 0 && view.chat.length === 0 && !view.sharedNote?.trim();
      if (empty) return await this.publish(msg, 'empty');

      const summary = await this.generate(renderMeetingPrompt(view));
      if (!summary) return await this.publish(msg, 'failed');
      await this.publish(msg, 'ok', summary);
    } catch (err) {
      this.logger.error(`Meeting summary ${meetingId}/${attempt} failed: ${(err as Error).message}`);
      await this.publish(msg, 'failed');
    }
  }

  private async publish(
    msg: MeetingSummarizeMessage,
    status: MeetingSummaryStatus,
    summary?: MeetingSummary,
  ): Promise<void> {
    await this.publisher.publishToChannel(MEETING_SUMMARY_RESULT_CHANNEL, {
      meetingId: msg.meetingId,
      attempt: msg.attempt,
      status,
      ...(summary ? { summary } : {}),
    });
    this.logger.log(`Published meeting summary ${msg.meetingId}/${msg.attempt}: ${status}`);
  }

  private async generate(prompt: string): Promise<MeetingSummary | null> {
    const res = await this.anthropic.messages.create(
      {
        model: this.model,
        max_tokens: 4000,
        system: MEETING_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      },
      // Worst case 2 x 3 min < the 10 min chat-service sweep, so a result never outlives its attempt.
      { timeout: 180_000, maxRetries: 1 },
    );
    this.usageService?.recordModelCall(this.botUserId, res.usage, 'meeting-summary');
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return parseMeetingSummary(text);
  }
}
