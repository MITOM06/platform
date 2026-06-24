import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/** Anthropic-supported vision media types (claude-api skill: jpeg|png|gif|webp ONLY). */
export const SUPPORTED_IMAGE_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type SupportedImageMediaType = (typeof SUPPORTED_IMAGE_MEDIA_TYPES)[number];

export class VisionUnsupportedException extends Error {
  constructor(mimeType: string) {
    super(`Vision media type not supported: ${mimeType}`);
    this.name = 'VisionUnsupportedException';
  }
}

export class VisionOversizedException extends Error {
  constructor(bytes: number, cap: number) {
    super(`Vision payload ${bytes} bytes exceeds cap ${cap}`);
    this.name = 'VisionOversizedException';
  }
}

const DESCRIBE_PROMPT =
  'You are an OCR + visual-description engine indexing this file for retrieval. ' +
  'Transcribe ALL visible text verbatim (every label, number, date, total, and table cell). ' +
  'Then describe charts, diagrams, tables, and layout in plain prose. ' +
  'Output plain text only — no markdown fences, no preamble, no commentary about the task.';

/** Vision-capable model id (claude-api skill: claude-opus-4-8 supports image_input). */
const DEFAULT_VISION_MODEL = 'claude-opus-4-8';

/**
 * Produces a plain-text description of an image or PDF via Claude vision, for the
 * KB indexing pipeline (TASK-10). Non-streaming `messages.create` with a single
 * image/document content block per the claude-api skill constraints. Throws on
 * unsupported media type / oversized payload / missing key so the caller degrades
 * gracefully (never crashes the KB pipeline).
 */
@Injectable()
export class VisionDescribeService {
  private readonly logger = new Logger(VisionDescribeService.name);
  private readonly anthropic?: Anthropic;
  private readonly model: string;
  private readonly maxImageBytes: number;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('config.anthropic.apiKey');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — VisionDescribeService disabled (KB vision off)');
    }
    this.model = this.configService.get<string>('config.anthropic.model') ?? DEFAULT_VISION_MODEL;
    this.maxImageBytes =
      this.configService.get<number>('config.kb.visionMaxImageBytes') ?? 5_000_000;
  }

  /** Whether vision is usable at all (an API key is configured). */
  isAvailable(): boolean {
    return !!this.anthropic;
  }

  /** Normalize/validate a mime to a supported image media type, or null. */
  static toSupportedImageMediaType(mimeType: string): SupportedImageMediaType | null {
    const mime = mimeType.toLowerCase().split(';')[0].trim();
    return (SUPPORTED_IMAGE_MEDIA_TYPES as readonly string[]).includes(mime)
      ? (mime as SupportedImageMediaType)
      : null;
  }

  /**
   * Describe a single image. Validates media type + size cap, then sends a base64
   * image block (no newlines) before the text prompt. Returns the transcription.
   */
  async describeImage(buffer: Buffer, mimeType: string): Promise<string> {
    if (!this.anthropic) throw new Error('VisionDescribeService: no API key configured');
    const mediaType = VisionDescribeService.toSupportedImageMediaType(mimeType);
    if (!mediaType) throw new VisionUnsupportedException(mimeType);
    if (buffer.byteLength > this.maxImageBytes) {
      throw new VisionOversizedException(buffer.byteLength, this.maxImageBytes);
    }

    const data = buffer.toString('base64');
    const message = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: DESCRIBE_PROMPT },
          ],
        },
      ],
    });
    return extractText(message);
  }

  /**
   * Describe a whole PDF via the SDK's native PDF document block. Used for
   * scanned/image-heavy PDFs whose pdf-parse text is sparse. Per-page
   * rasterization is DEFERRED (no rasterizer dependency this pass).
   */
  async describePdf(buffer: Buffer): Promise<string> {
    if (!this.anthropic) throw new Error('VisionDescribeService: no API key configured');
    if (buffer.byteLength > this.maxImageBytes) {
      throw new VisionOversizedException(buffer.byteLength, this.maxImageBytes);
    }

    const data = buffer.toString('base64');
    const message = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data },
            },
            { type: 'text', text: DESCRIBE_PROMPT },
          ],
        },
      ],
    });
    return extractText(message);
  }
}

/** Concatenate all text blocks of an Anthropic message into a single string. */
function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
