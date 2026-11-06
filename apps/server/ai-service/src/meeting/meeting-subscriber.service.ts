import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import Redis from 'ioredis';
import { MeetingSummaryService } from './meeting-summary.service';
import {
  MEETING_REDIS_SUBSCRIBER,
  MEETING_SUMMARIZE_CHANNEL,
  MeetingSummarizeMessage,
} from './meeting.constants';

/** Dedicated subscriber (own connection) for `meet:summarize`. */
@Injectable()
export class MeetingSubscriberService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MeetingSubscriberService.name);

  constructor(
    @Inject(MEETING_REDIS_SUBSCRIBER) private readonly client: Redis,
    private readonly summaryService: MeetingSummaryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.client.subscribe(MEETING_SUMMARIZE_CHANNEL);
      this.logger.log(`Subscribed to Redis channel: ${MEETING_SUMMARIZE_CHANNEL}`);
    } catch (err) {
      this.logger.error(`Failed to subscribe to ${MEETING_SUMMARIZE_CHANNEL}: ${(err as Error).message}`);
    }

    this.client.on('message', (channel: string, message: string) => {
      if (channel !== MEETING_SUMMARIZE_CHANNEL) return;
      let payload: MeetingSummarizeMessage;
      try {
        payload = JSON.parse(message) as MeetingSummarizeMessage;
      } catch {
        this.logger.warn('Dropping unparseable meet:summarize message');
        return;
      }
      const ok = (v: unknown) => typeof v === 'string' && v !== '';
      if (!ok(payload?.meetingId) || !ok(payload?.attempt) || !ok(payload?.requesterId)) {
        this.logger.warn('Dropping malformed meet:summarize message');
        return;
      }
      this.summaryService.summarize(payload).catch((err) => {
        this.logger.error(`Failed to summarize meeting ${payload.meetingId}`, err as Error);
      });
    });
  }
}
