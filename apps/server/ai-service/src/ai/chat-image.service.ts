import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { SupportedImageMediaType, VisionDescribeService } from '../kb/vision-describe.service';
import { resolveUploadUrl } from '../common/upload-ref';

/**
 * Resolves chat-message image refs into Anthropic image content blocks for the
 * agentic loop (TASK-10 chat vision). Media is served behind `/api/uploads/{id}`
 * on the chat host, so ai-service fetches the bytes server-side and
 * base64-encodes them.
 *
 * Hardened against hostile history entries (SSRF / DoS):
 *  - only chat upload ids are fetched, always from `config.chat.internalUrl`
 *    (`resolveUploadUrl` discards any host in the ref); redirects are refused;
 *  - the body is streamed with a hard byte cap (a declared oversize
 *    Content-Length is rejected before reading) and the whole fetch runs under
 *    an AbortController timeout.
 * Fully fail-soft: a skipped image never fails the request.
 */
@Injectable()
export class ChatImageService {
  private readonly logger = new Logger(ChatImageService.name);
  private readonly enabled: boolean;
  private readonly chatBaseUrl: string;
  private readonly maxImages: number;
  private readonly maxImageBytes: number;
  private readonly fetchTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('config.chat.visionEnabled') ?? true;
    this.chatBaseUrl = (
      this.configService.get<string>('config.chat.internalUrl') ?? 'http://localhost:8080'
    ).replace(/\/+$/, '');
    this.maxImages = this.configService.get<number>('config.chat.visionMaxImages') ?? 4;
    this.maxImageBytes =
      this.configService.get<number>('config.chat.visionMaxImageBytes') ?? 5_000_000;
    this.fetchTimeoutMs =
      this.configService.get<number>('config.chat.visionFetchTimeoutMs') ?? 10_000;
  }

  /** Whether chat vision is enabled at all. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Resolve a turn's image refs to base64 image blocks. Caps at maxImages; skips
   * any ref that is not a chat upload, is oversized, has an unsupported media
   * type, times out or fails to fetch.
   */
  async resolveImageBlocks(imageUrls: string[]): Promise<Anthropic.ImageBlockParam[]> {
    if (!this.enabled || !Array.isArray(imageUrls) || imageUrls.length === 0) return [];

    const blocks: Anthropic.ImageBlockParam[] = [];
    for (const ref of imageUrls.slice(0, this.maxImages)) {
      try {
        const block = await this.resolveOne(ref);
        if (block) blocks.push(block);
      } catch (err) {
        this.logger.warn(`Skipping chat image: ${(err as Error).message}`);
      }
    }
    return blocks;
  }

  /** Fetch one ref → validated base64 image block, or null if it must be skipped. */
  private async resolveOne(ref: string): Promise<Anthropic.ImageBlockParam | null> {
    const url = resolveUploadUrl(ref, this.chatBaseUrl);
    if (!url) {
      this.logger.warn('Skipping chat image: not a chat upload reference');
      return null;
    }

    const fetched = await this.fetchCapped(url);
    if (!fetched) return null;

    const mediaType =
      VisionDescribeService.toSupportedImageMediaType(fetched.contentType) ??
      sniffImageMediaType(fetched.body);
    if (!mediaType) {
      this.logger.warn(`Unsupported image media type for ${url} (content-type="${fetched.contentType}")`);
      return null;
    }

    return {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: fetched.body.toString('base64') },
    };
  }

  /** GET with a timeout covering connect + body, refusing redirects and bodies over the cap. */
  private async fetchCapped(url: string): Promise<{ body: Buffer; contentType: string } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, redirect: 'error' });
      if (!response.ok) {
        this.logger.warn(`Image fetch ${url} → HTTP ${response.status}`);
        await response.body?.cancel().catch(() => undefined);
        return null;
      }
      const declared = Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > this.maxImageBytes) {
        this.logger.warn(`Image ${url} declares ${declared} bytes, over cap ${this.maxImageBytes}`);
        await response.body?.cancel().catch(() => undefined);
        return null;
      }
      const body = await this.readCapped(response, url);
      if (!body) return null;
      return { body, contentType: response.headers.get('content-type') ?? '' };
    } catch (err) {
      const reason = controller.signal.aborted ? `timed out after ${this.fetchTimeoutMs}ms` : (err as Error).message;
      this.logger.warn(`Image fetch ${url} failed: ${reason}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Read the body chunk by chunk; abandon (and cancel) it as soon as it passes the cap. */
  private async readCapped(response: Response, url: string): Promise<Buffer | null> {
    if (!response.body) return Buffer.alloc(0);
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > this.maxImageBytes) {
        await reader.cancel().catch(() => undefined);
        this.logger.warn(`Image ${url} exceeds cap ${this.maxImageBytes} bytes — skipped`);
        return null;
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  }
}

/** Detect a vision-supported image type from its magic bytes (Content-Type missing/generic). */
export function sniffImageMediaType(buf: Buffer): SupportedImageMediaType | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString('latin1'))) return 'image/gif';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
