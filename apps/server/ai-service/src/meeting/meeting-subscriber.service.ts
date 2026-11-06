import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import Redis from 'ioredis';
import { MeetingMaterialService } from './meeting-material.service';
import { MeetingSummaryService } from './meeting-summary.service';
import {
  MEETING_MATERIAL_CHANNEL,
  MEETING_REDIS_SUBSCRIBER,
  MEETING_SUMMARIZE_CHANNEL,
  MeetingMaterialMessage,
  MeetingSummarizeMessage,
} from './meeting.constants';

const UPLOAD_ID_RE =
  /^(?:[0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Dedicated subscriber (own connection) for `meet:summarize` and `meet:material`. */
@Injectable()
export class MeetingSubscriberService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MeetingSubscriberService.name);

  constructor(
    @Inject(MEETING_REDIS_SUBSCRIBER) private readonly client: Redis,
    private readonly summaryService: MeetingSummaryService,
    private readonly materialService: MeetingMaterialService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.client.subscribe(MEETING_SUMMARIZE_CHANNEL, MEETING_MATERIAL_CHANNEL);
      this.logger.log(`Subscribed to Redis channels: ${MEETING_SUMMARIZE_CHANNEL}, ${MEETING_MATERIAL_CHANNEL}`);
    } catch (err) {
      this.logger.error(`Failed to subscribe to meeting channels: ${(err as Error).message}`);
    }

    this.client.on('message', (channel: string, message: string) => {
      if (channel === MEETING_MATERIAL_CHANNEL) return this.onMaterial(message);
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

  private onMaterial(message: string): void {
    let payload: MeetingMaterialMessage;
    try {
      payload = JSON.parse(message) as MeetingMaterialMessage;
    } catch {
      this.logger.warn('Dropping unparseable meet:material message');
      return;
    }
    const ok = (v: unknown) => typeof v === 'string' && v.trim() !== '';
    const valid =
      ok(payload?.meetingId) &&
      ok(payload?.messageId) &&
      ok(payload?.fileName) &&
      ok(payload?.userId) &&
      typeof payload?.uploadId === 'string' &&
      UPLOAD_ID_RE.test(payload.uploadId) &&
      (payload.mimeType == null || typeof payload.mimeType === 'string');
    if (!valid) {
      this.logger.warn(`Dropping malformed meet:material message (messageId=${String(payload?.messageId)})`);
      return;
    }
    this.materialService.process(payload).catch((err) => {
      this.logger.error(`Failed to read material ${payload.messageId}: ${(err as Error).message}`);
    });
  }
}
