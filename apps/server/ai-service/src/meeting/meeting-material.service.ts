import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { sniffImageMediaType } from '../ai/chat-image.service';
import { fetchUploadCapped } from '../common/fetch-upload-capped';
import { internalUploadHeaders, resolveUploadUrl } from '../common/upload-ref';
import { DocumentExtractorService, UnsupportedFileTypeException } from '../kb/document-extractor.service';
import {
  VisionDescribeService,
  VisionOversizedException,
  VisionUnsupportedException,
} from '../kb/vision-describe.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { REDIS_PUBLISHER } from '../redis/redis.constants';
import {
  MEETING_MATERIAL_RESULT_CHANNEL,
  MeetingMaterialMessage,
  MeetingMaterialStatus,
} from './meeting.constants';

export const MATERIAL_MAX_BYTES = 20_000_000;
export const MATERIAL_FETCH_TIMEOUT_MS = 20_000;
export const MATERIAL_TEXT_MAX_CHARS = 6000;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'log', 'tsv']);

type Outcome = { status: 'ok'; text: string } | { status: 'unsupported' | 'failed' };

/** Cut to `max` UTF-16 units without leaving half a surrogate pair. */
export function capText(text: string, max = MATERIAL_TEXT_MAX_CHARS): string {
  if (text.length <= max) return text;
  let end = max;
  const c = text.charCodeAt(end - 1);
  if (c >= 0xd800 && c <= 0xdbff) end--;
  return text.slice(0, end);
}

/**
 * Reads a file sent in a meeting chat (`meet:material`) and publishes its text,
 * or an image description, as `meet:material:result`. Vision goes only through
 * VisionDescribeService (Anthropic API). Fail-soft: always ends in one result.
 */
@Injectable()
export class MeetingMaterialService {
  private readonly logger = new Logger(MeetingMaterialService.name);
  private readonly chatBaseUrl: string;
  private readonly internalApiKey?: string;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly redis: Redis,
    private readonly publisher: RedisPublisherService,
    private readonly configService: ConfigService,
    private readonly extractor: DocumentExtractorService,
    private readonly vision: VisionDescribeService,
  ) {
    this.chatBaseUrl = (
      this.configService.get<string>('config.chat.internalUrl') ?? 'http://localhost:8080'
    ).replace(/\/+$/, '');
    this.internalApiKey = this.configService.get<string>('config.connector.internalApiKey');
  }

  async process(msg: MeetingMaterialMessage): Promise<void> {
    // pub/sub reaches every instance: only the claimant does the work.
    const claimed = await this.redis.set(`meet:material:claim:${msg.messageId}`, '1', 'EX', 3600, 'NX');
    if (claimed !== 'OK') return;

    let outcome: Outcome;
    try {
      outcome = await this.read(msg);
    } catch (err) {
      this.logger.warn(`Material ${msg.meetingId}/${msg.messageId} failed: ${(err as Error).message}`);
      outcome = { status: 'failed' };
    }
    try {
      await this.publisher.publishToChannel(MEETING_MATERIAL_RESULT_CHANNEL, {
        meetingId: msg.meetingId,
        messageId: msg.messageId,
        fileName: msg.fileName,
        status: outcome.status as MeetingMaterialStatus,
        ...(outcome.status === 'ok' ? { text: capText(outcome.text) } : {}),
      });
      this.logger.log(`Published meeting material ${msg.meetingId}/${msg.messageId}: ${outcome.status}`);
    } catch (err) {
      this.logger.error(`Publishing material result ${msg.messageId} failed: ${(err as Error).message}`);
    }
  }

  private async read(msg: MeetingMaterialMessage): Promise<Outcome> {
    const url = resolveUploadUrl(`/api/uploads/${msg.uploadId}`, this.chatBaseUrl);
    if (!url) return { status: 'failed' };

    // `url` is re-anchored on the internal chat base, the only place the key goes.
    const { body } = await fetchUploadCapped(url, {
      maxBytes: MATERIAL_MAX_BYTES,
      timeoutMs: MATERIAL_FETCH_TIMEOUT_MS,
      headers: internalUploadHeaders({ internalApiKey: this.internalApiKey }),
    });

    const route = classify(msg.mimeType, msg.fileName, body);
    if (!route) return { status: 'unsupported' };

    if (route.kind === 'image') {
      if (!this.vision.isAvailable()) return { status: 'unsupported' };
      try {
        return nonEmpty(await this.vision.describeImage(body, route.mime, msg.userId));
      } catch (err) {
        if (err instanceof VisionOversizedException || err instanceof VisionUnsupportedException) {
          return { status: 'unsupported' };
        }
        throw err;
      }
    }

    try {
      // Short PDF text is kept as is: no describePdf here (cost).
      return nonEmpty(await this.extractor.extractText(body, route.mime));
    } catch (err) {
      if (err instanceof UnsupportedFileTypeException) return { status: 'unsupported' };
      throw err;
    }
  }
}

function nonEmpty(text: string | null | undefined): Outcome {
  const t = (text ?? '').trim();
  return t ? { status: 'ok', text: t } : { status: 'unsupported' };
}

/** Decide how to read the file from declared mime, file extension and magic bytes. */
function classify(
  mimeType: string | null | undefined,
  fileName: string,
  body: Buffer,
): { kind: 'image' | 'doc'; mime: string } | null {
  const mime = (mimeType ?? '').toLowerCase().split(';')[0].trim();
  const generic = mime === '' || mime === 'application/octet-stream' || mime === 'binary/octet-stream';
  const ext = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? '';

  const declaredImage = VisionDescribeService.toSupportedImageMediaType(mime);
  if (declaredImage) return { kind: 'image', mime: declaredImage };
  if (generic) {
    const sniffed = sniffImageMediaType(body);
    if (sniffed) return { kind: 'image', mime: sniffed };
  }

  const isPdfBytes = body.length >= 4 && body.subarray(0, 4).toString('latin1') === '%PDF';
  if (mime === 'application/pdf' || (generic && (ext === 'pdf' || isPdfBytes))) {
    return { kind: 'doc', mime: 'application/pdf' };
  }
  const isZip = body.length >= 4 && body[0] === 0x50 && body[1] === 0x4b;
  if (mime === DOCX_MIME || (generic && ext === 'docx' && isZip)) return { kind: 'doc', mime: DOCX_MIME };
  if (mime.startsWith('text/')) return { kind: 'doc', mime };
  if (generic && TEXT_EXTENSIONS.has(ext)) return { kind: 'doc', mime: 'text/plain' };
  return null;
}
