import { ConfigService } from '@nestjs/config';
import {
  VisionDescribeService,
  VisionUnsupportedException,
  VisionOversizedException,
} from './vision-describe.service';

function makeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const map: Record<string, unknown> = {
    'config.anthropic.apiKey': 'test-key',
    'config.anthropic.model': 'claude-opus-4-8',
    'config.kb.visionMaxImageBytes': 5_000_000,
    ...overrides,
  };
  return { get: jest.fn().mockImplementation((k: string) => map[k]) } as unknown as ConfigService;
}

describe('VisionDescribeService', () => {
  describe('toSupportedImageMediaType', () => {
    it('accepts jpeg/png/gif/webp (case + params tolerant)', () => {
      expect(VisionDescribeService.toSupportedImageMediaType('image/png')).toBe('image/png');
      expect(VisionDescribeService.toSupportedImageMediaType('IMAGE/JPEG')).toBe('image/jpeg');
      expect(VisionDescribeService.toSupportedImageMediaType('image/webp; charset=binary')).toBe(
        'image/webp',
      );
    });

    it('rejects heic/bmp/svg and non-images', () => {
      expect(VisionDescribeService.toSupportedImageMediaType('image/heic')).toBeNull();
      expect(VisionDescribeService.toSupportedImageMediaType('image/bmp')).toBeNull();
      expect(VisionDescribeService.toSupportedImageMediaType('image/svg+xml')).toBeNull();
      expect(VisionDescribeService.toSupportedImageMediaType('application/pdf')).toBeNull();
    });
  });

  describe('availability', () => {
    it('is disabled (no client) when no API key', () => {
      const svc = new VisionDescribeService(makeConfig({ 'config.anthropic.apiKey': undefined }));
      expect(svc.isAvailable()).toBe(false);
    });

    it('is available when API key present', () => {
      const svc = new VisionDescribeService(makeConfig());
      expect(svc.isAvailable()).toBe(true);
    });

    it('describeImage rejects when no key configured', async () => {
      const svc = new VisionDescribeService(makeConfig({ 'config.anthropic.apiKey': undefined }));
      await expect(svc.describeImage(Buffer.from('x'), 'image/png')).rejects.toThrow();
    });
  });

  describe('describeImage', () => {
    let svc: VisionDescribeService;
    let create: jest.Mock;

    beforeEach(() => {
      svc = new VisionDescribeService(makeConfig());
      create = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Invoice total: $42.00' }],
      });
      (svc as any)['anthropic'] = { messages: { create } };
    });

    it('sends an image block before the prompt and returns the description', async () => {
      const result = await svc.describeImage(Buffer.from('imgbytes'), 'image/png');
      expect(result).toBe('Invoice total: $42.00');

      const params = create.mock.calls[0][0];
      expect(params.model).toBe('claude-opus-4-8');
      const content = params.messages[0].content;
      expect(content[0].type).toBe('image');
      expect(content[0].source).toEqual({
        type: 'base64',
        media_type: 'image/png',
        data: Buffer.from('imgbytes').toString('base64'),
      });
      expect(content[1].type).toBe('text');
    });

    it('throws VisionUnsupportedException for unsupported mime (no API call)', async () => {
      await expect(svc.describeImage(Buffer.from('x'), 'image/heic')).rejects.toThrow(
        VisionUnsupportedException,
      );
      expect(create).not.toHaveBeenCalled();
    });

    it('throws VisionOversizedException when over the byte cap (no API call)', async () => {
      const small = new VisionDescribeService(makeConfig({ 'config.kb.visionMaxImageBytes': 4 }));
      (small as any)['anthropic'] = { messages: { create } };
      await expect(small.describeImage(Buffer.from('toolong'), 'image/png')).rejects.toThrow(
        VisionOversizedException,
      );
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('describePdf', () => {
    it('sends a base64 application/pdf document block', async () => {
      const svc = new VisionDescribeService(makeConfig());
      const create = jest
        .fn()
        .mockResolvedValue({ content: [{ type: 'text', text: 'Scanned page text' }] });
      (svc as any)['anthropic'] = { messages: { create } };

      const result = await svc.describePdf(Buffer.from('%PDF-1.7'));
      expect(result).toBe('Scanned page text');
      const content = create.mock.calls[0][0].messages[0].content;
      expect(content[0].type).toBe('document');
      expect(content[0].source.media_type).toBe('application/pdf');
    });
  });
});
