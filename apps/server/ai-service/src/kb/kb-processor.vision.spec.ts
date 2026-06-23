import { ConfigService } from '@nestjs/config';
import { KbProcessorService } from './kb-processor.service';
import { DocumentExtractorService, UnsupportedFileTypeException } from './document-extractor.service';
import { VisionDescribeService } from './vision-describe.service';

/**
 * Focused unit tests on KbProcessorService.resolveText (TASK-10 vision routing +
 * graceful degradation). Mongo / vector-store / publisher deps are irrelevant to
 * this code path, so we construct the service with stubs and exercise the private
 * method directly.
 */
function makeService(opts: {
  visionEnabled?: boolean;
  visionPdfEnabled?: boolean;
  visionMinTextChars?: number;
  extractor?: Partial<DocumentExtractorService>;
  vision?: Partial<VisionDescribeService> & { isAvailable: () => boolean };
}): { service: KbProcessorService } {
  const config = {
    get: jest.fn().mockImplementation((k: string) => {
      const map: Record<string, unknown> = {
        'config.kb.qdrantCollection': 'knowledge',
        'config.kb.visionEnabled': opts.visionEnabled ?? true,
        'config.kb.visionPdfEnabled': opts.visionPdfEnabled ?? true,
        'config.kb.visionMinTextChars': opts.visionMinTextChars ?? 64,
      };
      return map[k];
    }),
  } as unknown as ConfigService;

  const real = new DocumentExtractorService();
  // Bind real prototype methods explicitly (spread only copies own enumerable
  // props, not prototype methods), then apply any per-test overrides.
  const extractor = {
    isImage: real.isImage.bind(real),
    isVisionSupportedImage: real.isVisionSupportedImage.bind(real),
    extractText: real.extractText.bind(real),
    ...opts.extractor,
  } as DocumentExtractorService;

  const vision = (opts.vision ?? {
    isAvailable: () => true,
    describeImage: jest.fn(),
    describePdf: jest.fn(),
  }) as unknown as VisionDescribeService;

  const service = new KbProcessorService(
    {} as never, // kbDocumentModel
    extractor,
    vision,
    {} as never, // textChunker
    {} as never, // embeddingService
    {} as never, // vectorStore
    {} as never, // publisher
    config,
  );
  return { service };
}

function resolveText(service: KbProcessorService, buf: Buffer, mime: string): Promise<string> {
  return (service as unknown as { resolveText: (b: Buffer, m: string) => Promise<string> }).resolveText(
    buf,
    mime,
  );
}

describe('KbProcessorService.resolveText (vision)', () => {
  it('describes a supported image via vision and indexes the description', async () => {
    const describeImage = jest.fn().mockResolvedValue('A bar chart of Q4 revenue: $1.2M');
    const { service } = makeService({
      vision: { isAvailable: () => true, describeImage } as never,
    });
    const text = await resolveText(service, Buffer.from('png'), 'image/png');
    expect(describeImage).toHaveBeenCalled();
    expect(text).toBe('A bar chart of Q4 revenue: $1.2M');
  });

  it('falls back to extractText (which throws) for images when KB_VISION_ENABLED=false', async () => {
    const describeImage = jest.fn();
    const { service } = makeService({
      visionEnabled: false,
      vision: { isAvailable: () => true, describeImage } as never,
    });
    await expect(resolveText(service, Buffer.from('png'), 'image/png')).rejects.toThrow(
      UnsupportedFileTypeException,
    );
    expect(describeImage).not.toHaveBeenCalled();
  });

  it('does not call vision for an unsupported image (heic) → degrades to extractText throw', async () => {
    const describeImage = jest.fn();
    const { service } = makeService({
      vision: { isAvailable: () => true, describeImage } as never,
    });
    await expect(resolveText(service, Buffer.from('x'), 'image/heic')).rejects.toThrow(
      UnsupportedFileTypeException,
    );
    expect(describeImage).not.toHaveBeenCalled();
  });

  it('degrades to extractText when image vision throws (no crash)', async () => {
    const describeImage = jest.fn().mockRejectedValue(new Error('vision 500'));
    const { service } = makeService({
      vision: { isAvailable: () => true, describeImage } as never,
    });
    // image/png is supported, vision fails → extractText(image/png) throws Unsupported
    await expect(resolveText(service, Buffer.from('png'), 'image/png')).rejects.toThrow(
      UnsupportedFileTypeException,
    );
  });

  it('routes a sparse-text PDF to describePdf and indexes the transcription', async () => {
    const describePdf = jest.fn().mockResolvedValue('Full scanned invoice transcription...');
    const { service } = makeService({
      extractor: { extractText: jest.fn().mockResolvedValue('   ') }, // sparse
      vision: { isAvailable: () => true, describePdf } as never,
    });
    const text = await resolveText(service, Buffer.from('%PDF'), 'application/pdf');
    expect(describePdf).toHaveBeenCalled();
    expect(text).toBe('Full scanned invoice transcription...');
  });

  it('does NOT route a normal text-rich PDF to vision', async () => {
    const describePdf = jest.fn();
    const longText = 'x'.repeat(500);
    const { service } = makeService({
      extractor: { extractText: jest.fn().mockResolvedValue(longText) },
      vision: { isAvailable: () => true, describePdf } as never,
    });
    const text = await resolveText(service, Buffer.from('%PDF'), 'application/pdf');
    expect(describePdf).not.toHaveBeenCalled();
    expect(text).toBe(longText);
  });

  it('falls back to sparse PDF text when PDF vision fails (no crash)', async () => {
    const describePdf = jest.fn().mockRejectedValue(new Error('vision 500'));
    const { service } = makeService({
      extractor: { extractText: jest.fn().mockResolvedValue('tiny') },
      vision: { isAvailable: () => true, describePdf } as never,
    });
    const text = await resolveText(service, Buffer.from('%PDF'), 'application/pdf');
    expect(text).toBe('tiny');
  });

  it('skips PDF vision when KB_VISION_PDF_ENABLED=false (indexes sparse text)', async () => {
    const describePdf = jest.fn();
    const { service } = makeService({
      visionPdfEnabled: false,
      extractor: { extractText: jest.fn().mockResolvedValue('tiny') },
      vision: { isAvailable: () => true, describePdf } as never,
    });
    const text = await resolveText(service, Buffer.from('%PDF'), 'application/pdf');
    expect(describePdf).not.toHaveBeenCalled();
    expect(text).toBe('tiny');
  });

  it('skips all vision when no API key (isAvailable=false)', async () => {
    const describeImage = jest.fn();
    const { service } = makeService({
      vision: { isAvailable: () => false, describeImage } as never,
    });
    await expect(resolveText(service, Buffer.from('png'), 'image/png')).rejects.toThrow(
      UnsupportedFileTypeException,
    );
    expect(describeImage).not.toHaveBeenCalled();
  });
});
