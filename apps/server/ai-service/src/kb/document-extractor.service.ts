import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
// pdf-parse is a CJS module without proper ESM default export typings
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

export class UnsupportedFileTypeException extends Error {
  constructor(mimeType: string) {
    super(`Unsupported file type: ${mimeType}`);
    this.name = 'UnsupportedFileTypeException';
  }
}

@Injectable()
export class DocumentExtractorService {
  /**
   * True when the mime is an image type Anthropic vision can ingest
   * (jpeg|png|gif|webp). The KB processor uses this to route image uploads to
   * vision instead of `extractText` (which has no text to extract from an image).
   */
  isVisionSupportedImage(mimeType: string): boolean {
    const mime = mimeType.toLowerCase().split(';')[0].trim();
    return (
      mime === 'image/jpeg' ||
      mime === 'image/png' ||
      mime === 'image/gif' ||
      mime === 'image/webp'
    );
  }

  /** True for any `image/*` mime (incl. heic/bmp/svg) — used for graceful messaging. */
  isImage(mimeType: string): boolean {
    return mimeType.toLowerCase().startsWith('image/');
  }

  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    const mime = mimeType.toLowerCase();

    if (mime === 'application/pdf') {
      const result = await pdfParse(buffer);
      return result.text;
    }

    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    if (mime.startsWith('text/')) {
      return buffer.toString('utf-8');
    }

    throw new UnsupportedFileTypeException(mimeType);
  }
}
