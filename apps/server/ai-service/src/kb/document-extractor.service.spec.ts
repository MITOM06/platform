import { DocumentExtractorService, UnsupportedFileTypeException } from './document-extractor.service';

jest.mock('pdf-parse', () => jest.fn());
jest.mock('mammoth', () => ({ extractRawText: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParseMock = require('pdf-parse') as jest.Mock;
import * as mammoth from 'mammoth';

describe('DocumentExtractorService', () => {
  let service: DocumentExtractorService;

  beforeEach(() => {
    service = new DocumentExtractorService();
    jest.clearAllMocks();
  });

  it('extracts text from PDF', async () => {
    pdfParseMock.mockResolvedValue({ text: 'PDF content' });
    const result = await service.extractText(Buffer.from('pdf'), 'application/pdf');
    expect(result).toBe('PDF content');
  });

  it('extracts text from DOCX', async () => {
    (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: 'DOCX content' });
    const result = await service.extractText(
      Buffer.from('docx'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(result).toBe('DOCX content');
  });

  it('extracts text from plain text file', async () => {
    const buf = Buffer.from('Hello world');
    const result = await service.extractText(buf, 'text/plain');
    expect(result).toBe('Hello world');
  });

  it('throws UnsupportedFileTypeException for unknown mime', async () => {
    await expect(
      service.extractText(Buffer.from('data'), 'application/octet-stream'),
    ).rejects.toThrow(UnsupportedFileTypeException);
  });
});
