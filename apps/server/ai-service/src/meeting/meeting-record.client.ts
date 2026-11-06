import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { internalUploadHeaders } from '../common/upload-ref';
import { MeetingRecordView } from './meeting.constants';

const TIMEOUT_MS = 10_000;

/** Fetches a finished meeting's record from chat-service's internal endpoint. */
@Injectable()
export class MeetingRecordClient {
  private readonly logger = new Logger(MeetingRecordClient.name);
  private readonly baseUrl: string;
  private readonly internalApiKey?: string;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('config.chat.internalUrl') ?? 'http://localhost:8080').replace(/\/+$/, '');
    this.internalApiKey = config.get<string>('config.connector.internalApiKey');
    if (!this.internalApiKey) {
      this.logger.warn('INTERNAL_API_KEY not configured: meeting record fetches will be rejected (401).');
    }
  }

  /** 404 -> null; 401, 5xx, network error or timeout -> throws. */
  async fetch(meetingId: string, userId: string): Promise<MeetingRecordView | null> {
    const url =
      `${this.baseUrl}/internal/meetings/${encodeURIComponent(meetingId)}/record` +
      `?userId=${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      headers: internalUploadHeaders({ internalApiKey: this.internalApiKey }),
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`meeting record fetch failed: HTTP ${res.status}`);
    return (await res.json()) as MeetingRecordView;
  }
}
