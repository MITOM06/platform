import { readFileSync } from 'fs';
import { join } from 'path';
import { MeetingMaterialService, SCREEN_PROMPT, capText } from './meeting-material.service';
import { MEETING_MATERIAL_RESULT_CHANNEL } from './meeting.constants';
import { UnsupportedFileTypeException } from '../kb/document-extractor.service';
import { VisionOversizedException } from '../kb/vision-describe.service';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const msg = { meetingId: 'm1', messageId: 'x1', uploadId: UUID, fileName: 'a.pdf', mimeType: 'application/pdf', userId: 'u1' };
const BASE = 'http://chat.internal:8080';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

function streamOf(chunks: Buffer[], onPull?: () => void): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(c) {
      onPull?.();
      if (i < chunks.length) c.enqueue(new Uint8Array(chunks[i++]));
      else c.close();
    },
  });
}
function res(body: Buffer | ReadableStream<Uint8Array>, headers: Record<string, string> = {}, status = 200) {
  return new Response(body as never, { status, headers });
}

function setup(opts: { claim?: string | null; visionAvailable?: boolean } = {}) {
  const redis = { set: jest.fn().mockResolvedValue(opts.claim === undefined ? 'OK' : opts.claim) };
  const publisher = { publishToChannel: jest.fn().mockResolvedValue(undefined) };
  const cfg: Record<string, string> = { 'config.chat.internalUrl': BASE, 'config.connector.internalApiKey': 'k3y' };
  const config = { get: (k: string) => cfg[k] };
  const extractor = { extractText: jest.fn().mockResolvedValue('hello world') };
  const vision = {
    isAvailable: jest.fn().mockReturnValue(opts.visionAvailable ?? true),
    describeImage: jest.fn().mockResolvedValue('a cat'),
  };
  const svc = new MeetingMaterialService(redis as never, publisher as never, config as never, extractor as never, vision as never);
  const published = () => publisher.publishToChannel.mock.calls.map((c) => c[1]);
  return { svc, redis, publisher, extractor, vision, published };
}

let fetchMock: jest.SpyInstance;
beforeEach(() => {
  fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => res(Buffer.from('%PDF-1.4 data')));
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('MeetingMaterialService', () => {
  it('claims NX/EX and does nothing when the claim is lost', async () => {
    const s = setup({ claim: null });
    await s.svc.process(msg);
    expect(s.redis.set).toHaveBeenCalledWith('meet:material:claim:x1', '1', 'EX', 3600, 'NX');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(s.publisher.publishToChannel).not.toHaveBeenCalled();
  });

  it('fetches from the internal base with the key, redirects refused, then publishes ok', async () => {
    const s = setup();
    await s.svc.process(msg);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/uploads/${UUID}`);
    expect(init.redirect).toBe('error');
    expect(init.headers).toEqual({ 'X-Internal-Key': 'k3y' });
    expect(s.extractor.extractText).toHaveBeenCalledWith(expect.any(Buffer), 'application/pdf');
    expect(s.publisher.publishToChannel).toHaveBeenCalledWith(MEETING_MATERIAL_RESULT_CHANNEL, {
      meetingId: 'm1', messageId: 'x1', fileName: 'a.pdf', status: 'ok', text: 'hello world', kind: 'file',
    });
  });

  it('never fetches an id that is not an upload id (nothing leaves the internal base) -> failed', async () => {
    const s = setup();
    await s.svc.process({ ...msg, uploadId: '../../evil' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(s.published()[0]).toMatchObject({ status: 'failed' });
    expect(s.published()[0]).not.toHaveProperty('text');
  });

  it('caps text at 6000 without splitting a surrogate pair', async () => {
    const s = setup();
    s.extractor.extractText.mockResolvedValue('a'.repeat(5999) + '😀' + 'b'.repeat(100));
    await s.svc.process(msg);
    const text = s.published()[0].text as string;
    expect(text.length).toBe(5999);
    expect(capText('😀'.repeat(4000)).length).toBe(6000);
  });

  it.each([
    ['docx by extension on octet-stream', 'r.docx', 'application/octet-stream', Buffer.from('PK\x03\x04zz', 'latin1'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['pdf by magic when mime null', 'noext', null, Buffer.from('%PDF-1.7'), 'application/pdf'],
    ['text by mime', 'n.txt', 'text/plain; charset=utf-8', Buffer.from('hi'), 'text/plain'],
    ['text by extension', 'n.md', 'application/octet-stream', Buffer.from('hi'), 'text/plain'],
  ])('routes %s to the extractor', async (_n, fileName, mimeType, body, expected) => {
    fetchMock.mockImplementation(async () => res(body));
    const s = setup();
    await s.svc.process({ ...msg, fileName, mimeType });
    expect(s.extractor.extractText).toHaveBeenCalledWith(expect.any(Buffer), expected);
    expect(s.published()[0].status).toBe('ok');
  });

  it('keeps short PDF text as is and never calls describePdf', async () => {
    const s = setup();
    (s.vision as Record<string, unknown>).describePdf = jest.fn();
    s.extractor.extractText.mockResolvedValue('tiny');
    await s.svc.process(msg);
    expect(s.published()[0]).toMatchObject({ status: 'ok', text: 'tiny' });
    expect((s.vision as unknown as { describePdf: jest.Mock }).describePdf).not.toHaveBeenCalled();
  });

  it('empty extracted text -> unsupported', async () => {
    const s = setup();
    s.extractor.extractText.mockResolvedValue('  \n ');
    await s.svc.process(msg);
    expect(s.published()[0]).toMatchObject({ status: 'unsupported' });
  });

  it('supported image -> describeImage with the user -> ok', async () => {
    fetchMock.mockImplementation(async () => res(PNG));
    const s = setup();
    await s.svc.process({ ...msg, fileName: 'p', mimeType: 'image/png' });
    expect(s.vision.describeImage).toHaveBeenCalledWith(expect.any(Buffer), 'image/png', 'u1');
    expect(s.extractor.extractText).not.toHaveBeenCalled();
    expect(s.published()[0]).toMatchObject({ status: 'ok', text: 'a cat' });
  });

  it('image sniffed from magic bytes when the mime is generic', async () => {
    fetchMock.mockImplementation(async () => res(PNG));
    const s = setup();
    await s.svc.process({ ...msg, fileName: 'p', mimeType: null });
    expect(s.vision.describeImage).toHaveBeenCalledWith(expect.any(Buffer), 'image/png', 'u1');
  });

  it('declared image whose bytes are not an image -> unsupported, no vision call', async () => {
    fetchMock.mockImplementation(async () => res(Buffer.from('<html>not an image</html>')));
    const s = setup();
    await s.svc.process({ ...msg, fileName: 'p.png', mimeType: 'image/png' });
    expect(s.vision.describeImage).not.toHaveBeenCalled();
    expect(s.published()[0]).toMatchObject({ status: 'unsupported' });
  });

  it('a redis claim error still ends in one failed result', async () => {
    const s = setup();
    s.redis.set.mockRejectedValue(new Error('redis down'));
    await s.svc.process(msg);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(s.published()).toEqual([expect.objectContaining({ messageId: 'x1', status: 'failed' })]);
  });

  it('reads at most 2 files at once; a third waits for a free slot', async () => {
    const s = setup();
    const release: (() => void)[] = [];
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => release.push(() => resolve(res(Buffer.from('%PDF-1.4 data'))))),
    );
    const runs = [1, 2, 3].map((i) => s.svc.process({ ...msg, messageId: `c${i}` }));
    await new Promise((r) => setImmediate(r));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    release[0]();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    release[1]();
    release[2]();
    await Promise.all(runs);
    expect(s.published()).toHaveLength(3);
  });

  it('oversized image (>5 MB) -> unsupported', async () => {
    fetchMock.mockImplementation(async () => res(PNG));
    const s = setup();
    s.vision.describeImage.mockRejectedValue(new VisionOversizedException(6e6, 5e6));
    await s.svc.process({ ...msg, mimeType: 'image/png' });
    expect(s.published()[0]).toMatchObject({ status: 'unsupported' });
  });

  it('vision unavailable -> unsupported without calling it', async () => {
    fetchMock.mockImplementation(async () => res(PNG));
    const s = setup({ visionAvailable: false });
    await s.svc.process({ ...msg, mimeType: 'image/png' });
    expect(s.vision.describeImage).not.toHaveBeenCalled();
    expect(s.published()[0]).toMatchObject({ status: 'unsupported' });
  });

  it.each([
    ['heic image', 'image/heic', 'x.heic'],
    ['zip', 'application/zip', 'x.zip'],
    ['xlsx', 'application/vnd.ms-excel', 'x.xlsx'],
  ])('%s -> unsupported', async (_n, mimeType, fileName) => {
    const s = setup();
    await s.svc.process({ ...msg, mimeType, fileName });
    expect(s.published()[0]).toMatchObject({ status: 'unsupported' });
    expect(s.extractor.extractText).not.toHaveBeenCalled();
  });

  it('extractor UnsupportedFileTypeException -> unsupported; other throw -> failed', async () => {
    const a = setup();
    a.extractor.extractText.mockRejectedValue(new UnsupportedFileTypeException('x'));
    await a.svc.process(msg);
    expect(a.published()[0]).toMatchObject({ status: 'unsupported' });
    const b = setup();
    b.extractor.extractText.mockRejectedValue(new Error('corrupt'));
    await b.svc.process(msg);
    expect(b.published()[0]).toMatchObject({ status: 'failed' });
  });

  it('declared Content-Length >= cap -> failed, body not read', async () => {
    const pulled = jest.fn();
    fetchMock.mockImplementation(async () =>
      res(streamOf([Buffer.from('x')], pulled), { 'content-length': '20000001' }));
    const s = setup();
    await s.svc.process(msg);
    expect(s.published()[0]).toMatchObject({ status: 'failed' });
    expect(s.extractor.extractText).not.toHaveBeenCalled();
  });

  it('stream passing the cap aborts early without reading the rest', async () => {
    const pulled = jest.fn();
    const chunk = Buffer.alloc(8_000_000);
    fetchMock.mockImplementation(async () => res(streamOf(Array(50).fill(chunk), pulled)));
    const s = setup();
    await s.svc.process(msg);
    expect(s.published()[0]).toMatchObject({ status: 'failed' });
    expect(pulled.mock.calls.length).toBeLessThan(10);
  });

  it('timeout (20 s over the whole body) -> failed', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_u: string, init: RequestInit) =>
      new Promise((_r, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted')))));
    const s = setup();
    const p = s.svc.process(msg);
    await jest.advanceTimersByTimeAsync(20_001);
    await p;
    expect(s.published()[0]).toMatchObject({ status: 'failed' });
  });

  it('HTTP error -> failed', async () => {
    fetchMock.mockImplementation(async () => res(Buffer.from('no'), {}, 403));
    const s = setup();
    await s.svc.process(msg);
    expect(s.published()[0]).toMatchObject({ status: 'failed' });
  });

  describe('screen frames', () => {
    const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
    const screen = { ...msg, kind: 'screen' as const, fileName: 'screen.jpg', mimeType: 'image/jpeg' };

    it('describes a JPEG with the screen prompt, 800 tokens, meeting-screen label; text capped 1500', async () => {
      fetchMock.mockImplementation(async () => res(JPEG));
      const s = setup();
      s.vision.describeImage.mockResolvedValue('x'.repeat(2000));
      await s.svc.process(screen);
      const [buf, mime, userId, opts] = s.vision.describeImage.mock.calls[0];
      expect(buf).toEqual(JPEG);
      expect(mime).toBe('image/jpeg');
      expect(userId).toBe('u1');
      expect(opts).toEqual({ prompt: SCREEN_PROMPT, maxTokens: 800, usageLabel: 'meeting-screen' });
      expect(s.published()[0]).toMatchObject({ status: 'ok', messageId: 'x1' });
      expect(s.published()[0].text).toHaveLength(1500);
    });

    it('publishes kind screen on every status, matching the shared contract fixture', async () => {
      fetchMock.mockImplementation(async () => res(JPEG));
      const s = setup();
      s.vision.describeImage.mockResolvedValue('Slide: Q3 plan');
      await s.svc.process({ ...screen, messageId: 'fr1' });
      const fixture = JSON.parse(
        readFileSync(join(__dirname, '../../../contracts/meet-material-result.screen.json'), 'utf8'),
      );
      expect(s.published()[0]).toEqual(fixture);
      const f = setup();
      f.vision.describeImage.mockRejectedValue(new Error('boom'));
      await f.svc.process(screen);
      expect(f.published()[0]).toMatchObject({ kind: 'screen', status: 'failed' });
    });

    it('claim failure path (thrown) still carries kind', async () => {
      const s = setup();
      s.redis.set.mockRejectedValue(new Error('redis down'));
      await s.svc.process(screen);
      expect(s.published()[0]).toMatchObject({ kind: 'screen', status: 'failed' });
      const t = setup();
      t.redis.set.mockRejectedValue(new Error('redis down'));
      await t.svc.process(msg);
      expect(t.published()[0]).toMatchObject({ kind: 'file', status: 'failed' });
    });

    it('bytes that are not an image -> unsupported, no vision call', async () => {
      fetchMock.mockImplementation(async () => res(Buffer.from('%PDF-1.4 data')));
      const s = setup();
      await s.svc.process(screen);
      expect(s.vision.describeImage).not.toHaveBeenCalled();
      expect(s.published()[0]).toMatchObject({ status: 'unsupported' });
    });

    it('over 3 MB -> failed, no vision call', async () => {
      fetchMock.mockImplementation(async () => res(Buffer.alloc(3_000_001, 0xff)));
      const s = setup();
      await s.svc.process(screen);
      expect(s.vision.describeImage).not.toHaveBeenCalled();
      expect(s.published()[0]).toMatchObject({ status: 'failed' });
    });

    it('vision unavailable or oversized -> unsupported; other vision error -> failed', async () => {
      fetchMock.mockImplementation(async () => res(JPEG));
      const a = setup({ visionAvailable: false });
      await a.svc.process(screen);
      expect(a.published()[0]).toMatchObject({ status: 'unsupported' });
      const b = setup();
      b.vision.describeImage.mockRejectedValue(new VisionOversizedException(9, 5));
      await b.svc.process(screen);
      expect(b.published()[0]).toMatchObject({ status: 'unsupported' });
      const c = setup();
      c.vision.describeImage.mockRejectedValue(new Error('boom'));
      await c.svc.process(screen);
      expect(c.published()[0]).toMatchObject({ status: 'failed' });
    });

    it('missing kind stays a file: 20 MB cap path, default describeImage call', async () => {
      fetchMock.mockImplementation(async () => res(PNG));
      const s = setup();
      await s.svc.process({ ...msg, fileName: 'a.png', mimeType: 'image/png' });
      expect(s.vision.describeImage).toHaveBeenCalledWith(PNG, 'image/png', 'u1');
    });
  });
});
