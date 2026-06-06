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
