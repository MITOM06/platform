import { EmbeddingService } from './embedding.service';

function make(config: Record<string, unknown>) {
  return new EmbeddingService({ get: jest.fn((k: string) => config[k]) } as never);
}

describe('EmbeddingService', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('is disabled without a Voyage key: throws, never calls the network', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(make({ 'config.voyage.apiKey': '' }).embed(['a'])).rejects.toThrow(
      'EmbeddingService: VOYAGE_API_KEY not configured',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('batches by 100, sends the key + model, and reorders each batch by index', async () => {
    const fetchMock = jest.fn(async (_url: string, init: { body: string }) => {
      const input = JSON.parse(init.body).input as string[];
      const data = input.map((t, i) => ({ embedding: [Number(t)], index: i })).reverse();
      return { ok: true, json: async () => ({ data }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const texts = Array.from({ length: 150 }, (_, i) => String(i));

    const out = await make({ 'config.voyage.apiKey': 'vk' }).embed(texts);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
    expect(init.headers.Authorization).toBe('Bearer vk');
    expect(JSON.parse(init.body).model).toBe('voyage-4-lite');
    expect(JSON.parse(init.body).input).toHaveLength(100);
    expect(out).toEqual(texts.map((t) => [Number(t)]));
  });

  it('uses the configured model', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ embedding: [1], index: 0 }] }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(make({ 'config.voyage.apiKey': 'vk', 'config.kb.embeddingModel': 'voyage-4' }).embedOne('q')).resolves.toEqual([1]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('voyage-4');
  });

  it('surfaces a non-ok response with status and a truncated body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'r'.repeat(500),
    }) as unknown as typeof fetch;
    await expect(make({ 'config.voyage.apiKey': 'vk' }).embed(['a'])).rejects.toThrow(
      `Voyage embeddings 429: ${'r'.repeat(200)}`,
    );
  });

  it('still reports the status when the error body cannot be read', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error('stream')),
    }) as unknown as typeof fetch;
    await expect(make({ 'config.voyage.apiKey': 'vk' }).embed(['a'])).rejects.toThrow('Voyage embeddings 500: ');
  });
});
