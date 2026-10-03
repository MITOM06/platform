import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

/** pdf-parse v2 separates pages with `-- N of M --`; that is not document text. */
const PAGE_MARKER = /^\s*-- \d+ of \d+ --\s*$/gm;

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
      // pdf-parse v2 is class-based. The v1 call style (`pdfParse(buffer)`) threw
      // "pdfParse is not a function", so every PDF upload ended in status=error.
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text.replace(PAGE_MARKER, '').trim();
      } finally {
        await parser.destroy();
      }
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
