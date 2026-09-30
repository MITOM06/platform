import { DocumentExtractorService, UnsupportedFileTypeException } from './document-extractor.service';

import { execFileSync } from 'node:child_process';

// Mocked with the v2 (class-based) shape. A mock written against v1 hid that the
// installed v2 had changed API and every real PDF upload failed — the contract
// test at the bottom runs the REAL library so that cannot happen silently again.
const getText = jest.fn();
const destroy = jest.fn().mockResolvedValue(undefined);
jest.mock('pdf-parse', () => ({ PDFParse: jest.fn().mockImplementation(() => ({ getText, destroy })) }));
jest.mock('mammoth', () => ({ extractRawText: jest.fn() }));

import * as mammoth from 'mammoth';

/** Minimal one-page PDF; with `text` it has a text layer, without it is blank (like a scan). */
function makePdf(text?: string): Buffer {
  const stream = text ? `BT /F1 12 Tf 50 750 Td (${text}) Tj ET` : '';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (out += `${String(o).padStart(10, '0')} 00000 n \n`));
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

describe('DocumentExtractorService', () => {
  let service: DocumentExtractorService;

  beforeEach(() => {
    service = new DocumentExtractorService();
    jest.clearAllMocks();
  });

  it('extracts text from PDF and releases the parser', async () => {
    getText.mockResolvedValue({ text: 'PDF content\n\n-- 1 of 1 --\n\n' });
    const result = await service.extractText(Buffer.from('%PDF'), 'application/pdf');
    expect(result).toBe('PDF content');
    expect(destroy).toHaveBeenCalled();
  });

  it('strips page markers so a text-less (scanned) PDF reads as empty', async () => {
    // KbProcessor routes sparse PDFs to vision; "-- 1 of 1 --" must not count as text.
    getText.mockResolvedValue({ text: '\n\n-- 1 of 2 --\n\n\n\n-- 2 of 2 --\n\n' });
    await expect(service.extractText(Buffer.from('%PDF'), 'application/pdf')).resolves.toBe('');
  });

  it('releases the parser even when parsing fails', async () => {
    getText.mockRejectedValue(new Error('InvalidPDFException'));
    await expect(service.extractText(Buffer.from('x'), 'application/pdf')).rejects.toThrow();
    expect(destroy).toHaveBeenCalled();
  });

  it('contract: the installed pdf-parse reads a real PDF the way the service calls it', () => {
    // Runs outside Jest's VM (pdfjs needs dynamic import for its worker).
    const script =
      "const { PDFParse } = require('pdf-parse');" +
      "const p = new PDFParse({ data: Buffer.from(process.argv[1], 'base64') });" +
      'p.getText().then(async (r) => { process.stdout.write(r.text); await p.destroy(); });';
    const pdf = makePdf('Leave policy code LEAVE-2026-B').toString('base64');
    const out = execFileSync(process.execPath, ['-e', script, pdf], { cwd: __dirname, encoding: 'utf8' });
    expect(out).toContain('Leave policy code LEAVE-2026-B');
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

  it('still throws UnsupportedFileTypeException for image mimes (vision is routed by the processor)', async () => {
    await expect(service.extractText(Buffer.from('img'), 'image/png')).rejects.toThrow(
      UnsupportedFileTypeException,
    );
  });

  describe('vision helpers', () => {
    it('isVisionSupportedImage true only for jpeg/png/gif/webp', () => {
      expect(service.isVisionSupportedImage('image/png')).toBe(true);
      expect(service.isVisionSupportedImage('image/jpeg')).toBe(true);
      expect(service.isVisionSupportedImage('IMAGE/WEBP')).toBe(true);
      expect(service.isVisionSupportedImage('image/gif')).toBe(true);
      expect(service.isVisionSupportedImage('image/heic')).toBe(false);
      expect(service.isVisionSupportedImage('image/svg+xml')).toBe(false);
      expect(service.isVisionSupportedImage('application/pdf')).toBe(false);
    });

    it('isImage true for any image/* mime', () => {
      expect(service.isImage('image/heic')).toBe(true);
      expect(service.isImage('image/png')).toBe(true);
      expect(service.isImage('application/pdf')).toBe(false);
    });
  });
});
