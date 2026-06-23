import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { VisionDescribeService } from '../kb/vision-describe.service';

/**
 * Resolves chat-message image URLs into Anthropic image content blocks for the
 * agentic loop (TASK-10 chat vision). Media is served behind `/api/uploads/{id}`
 * on the chat host, so a public `url` source is unreliable — instead ai-service
 * fetches the bytes server-side and base64-encodes them (same authless fetch
 * pattern KB already uses). Fully fail-soft: oversized / unsupported / unfetchable
 * images are skipped (logged), and the count is capped, so a text-only answer is
 * always still possible.
 */
@Injectable()
export class ChatImageService {
  private readonly logger = new Logger(ChatImageService.name);
  private readonly enabled: boolean;
  private readonly chatBaseUrl: string;
  private readonly maxImages: number;
  private readonly maxImageBytes: number;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('config.chat.visionEnabled') ?? true;
    this.chatBaseUrl = (
      this.configService.get<string>('config.chat.internalUrl') ?? 'http://localhost:8080'
    ).replace(/\/+$/, '');
    this.maxImages = this.configService.get<number>('config.chat.visionMaxImages') ?? 4;
    this.maxImageBytes =
      this.configService.get<number>('config.chat.visionMaxImageBytes') ?? 5_000_000;
  }

  /** Whether chat vision is enabled at all. */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Resolve a turn's image URLs to base64 image blocks. Caps at maxImages; skips
   * any image that is oversized, an unsupported media type, or fails to fetch.
   */
  async resolveImageBlocks(imageUrls: string[]): Promise<Anthropic.ImageBlockParam[]> {
    if (!this.enabled || !Array.isArray(imageUrls) || imageUrls.length === 0) return [];

    const blocks: Anthropic.ImageBlockParam[] = [];
    for (const ref of imageUrls.slice(0, this.maxImages)) {
      try {
        const block = await this.resolveOne(ref);
        if (block) blocks.push(block);
      } catch (err) {
        this.logger.warn(`Skipping chat image ${ref}: ${(err as Error).message}`);
      }
    }
    return blocks;
  }

  /** Fetch one image ref → validated base64 image block, or null if it must be skipped. */
  private async resolveOne(ref: string): Promise<Anthropic.ImageBlockParam | null> {
    const url = this.toAbsolute(ref);
    const response = await fetch(url);
    if (!response.ok) {
      this.logger.warn(`Image fetch ${url} → HTTP ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength > this.maxImageBytes) {
      this.logger.warn(`Image ${url} ${buffer.byteLength} bytes exceeds cap ${this.maxImageBytes}`);
      return null;
    }

    // Infer media type from Content-Type, falling back to the URL extension.
    const contentType = response.headers.get('content-type') ?? '';
    const mediaType =
      VisionDescribeService.toSupportedImageMediaType(contentType) ??
      VisionDescribeService.toSupportedImageMediaType(extToMime(ref));
    if (!mediaType) {
      this.logger.warn(`Unsupported image media type for ${url} (content-type="${contentType}")`);
      return null;
    }

    return {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
    };
  }

  /** Resolve a (possibly relative `/api/uploads/{id}`) ref against the chat host. */
  private toAbsolute(ref: string): string {
    if (/^https?:\/\//i.test(ref)) return ref;
    return `${this.chatBaseUrl}/${ref.replace(/^\/+/, '')}`;
  }
}

/** Best-effort mime from a URL/path extension (used when Content-Type is absent). */
function extToMime(ref: string): string {
  const clean = ref.split('?')[0].toLowerCase();
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.webp')) return 'image/webp';
  return '';
}
