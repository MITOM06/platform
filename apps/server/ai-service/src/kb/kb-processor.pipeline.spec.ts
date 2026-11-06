import { ConfigService } from '@nestjs/config';
import { KbProcessorService } from './kb-processor.service';

/**
 * processDocument end to end (fetch → extract → chunk → embed → upsert → status)
 * plus the SSRF guard on `fileUrl`, which arrives over Redis and is re-validated
 * here as defense in depth. Retrieval scoping (getReadyDocumentIds) decides which
 * documents a chat can see, so its filter is pinned exactly.
 */
function chain<T>(value: T) {
  const exec = jest.fn().mockResolvedValue(value);
  const lean = jest.fn().mockReturnValue({ exec });
  const select = jest.fn().mockReturnValue({ lean });
  return { select, lean, exec };
}

function make(opts: {
  text?: string;
  chunks?: string[];
  vectors?: number[][];
  fetchOk?: boolean;
  findResult?: unknown[];
  findError?: Error;
} = {}) {
  const findChain = chain(opts.findResult ?? []);
  if (opts.findError) findChain.exec.mockRejectedValue(opts.findError);
  const model = {
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockReturnValue({ select: findChain.select }),
  };
  const extractor = {
    isImage: jest.fn().mockReturnValue(false),
    extractText: jest.fn().mockResolvedValue(opts.text ?? 'hello world'),
  };
  const vision = { isAvailable: jest.fn().mockReturnValue(false) };
  const chunker = { chunk: jest.fn().mockReturnValue(opts.chunks ?? ['c1', 'c2']) };
  const embedding = { embed: jest.fn().mockResolvedValue(opts.vectors ?? [[1, 2, 3], [4, 5, 6]]) };
  const vectorStore = {
    ensureCollection: jest.fn().mockResolvedValue(undefined),
    upsertChunks: jest.fn().mockResolvedValue(undefined),
  };
  const publisher = { publishToChannel: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: jest.fn((k: string) =>
      ({
        'config.chat.internalUrl': 'http://chat-service:8080',
        'config.connector.internalApiKey': 'k',
      })[k],
    ),
  } as unknown as ConfigService;
  const svc = new KbProcessorService(
    model as never,
    extractor as never,
    vision as never,
    chunker as never,
    embedding as never,
    vectorStore as never,
    publisher as never,
    config,
  );
  const fetchMock = jest.fn().mockResolvedValue({
    ok: opts.fetchOk ?? true,
    status: opts.fetchOk === false ? 404 : 200,
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode('raw').buffer),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { svc, model, extractor, chunker, embedding, vectorStore, publisher, fetchMock, findChain };
}

const payload = (over: Record<string, unknown> = {}) =>
  ({
    documentId: 'doc-1',
    conversationId: 'conv-1',
    userId: 'u1',
    fileUrl: '/api/uploads/abc',
    mimeType: 'text/plain',
    fileName: 'notes.txt',
    ...over,
  }) as never;

describe('KbProcessorService.processDocument', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalEnv;
  });

  it('indexes the document, marks it done and notifies chat-service', async () => {
    const m = make();
    await m.svc.processDocument(payload({ departmentId: 'dept-1' }));

    expect(m.model.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { documentId: 'doc-1' },
      {
        $set: {
          conversationId: 'conv-1',
          userId: 'u1',
          fileName: 'notes.txt',
          mimeType: 'text/plain',
          status: 'processing',
          departmentId: 'dept-1',
        },
        $setOnInsert: { documentId: 'doc-1', uploadedAt: expect.any(Date) },
      },
      { upsert: true, new: true },
    );
    expect(m.chunker.chunk).toHaveBeenCalledWith('hello world', 512, 80);
    expect(m.vectorStore.ensureCollection).toHaveBeenCalledWith('knowledge', 3);
    expect(m.vectorStore.upsertChunks).toHaveBeenCalledWith('knowledge', 'doc-1', ['c1', 'c2'], [
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(m.model.findOneAndUpdate).toHaveBeenLastCalledWith(
      { documentId: 'doc-1' },
      { $set: { status: 'done', chunkCount: 2 } },
    );
    expect(m.publisher.publishToChannel).toHaveBeenCalledWith('kb:status:doc-1', {
      type: 'KB_DONE',
      documentId: 'doc-1',
      conversationId: 'conv-1',
      chunkCount: 2,
    });
  });

  it('does not write a departmentId for a personal-chat upload', async () => {
    const m = make();
    await m.svc.processDocument(payload());
    expect(m.model.findOneAndUpdate.mock.calls[0][1].$set).not.toHaveProperty('departmentId');
  });

  async function expectError(m: ReturnType<typeof make>, p: unknown, errorPart: string) {
    await m.svc.processDocument(p as never);
    expect(m.model.findOneAndUpdate).toHaveBeenLastCalledWith(
      { documentId: 'doc-1' },
      { $set: { status: 'error' } },
    );
    expect(m.publisher.publishToChannel).toHaveBeenCalledWith('kb:status:doc-1', {
      type: 'KB_ERROR',
      documentId: 'doc-1',
      conversationId: 'conv-1',
      error: expect.stringContaining(errorPart),
    });
    expect(m.vectorStore.upsertChunks).not.toHaveBeenCalled();
  }

  it('marks the document error when the upload fetch is not ok', async () => {
    await expectError(make({ fetchOk: false }), payload(), 'HTTP 404');
  });

  it('marks the document error when no text could be chunked', async () => {
    await expectError(make({ chunks: [] }), payload(), 'No text extracted');
  });

  it('marks the document error when embeddings come back empty (no zero-dim collection)', async () => {
    const m = make({ vectors: [] });
    await expectError(m, payload(), 'Embedding produced no usable vectors');
    expect(m.vectorStore.ensureCollection).not.toHaveBeenCalled();
  });

  it('marks the document error when the first vector has no dimension', async () => {
    await expectError(make({ vectors: [[]] }), payload(), 'Embedding produced no usable vectors');
  });

  it('still reports KB_ERROR when the error-status write itself fails', async () => {
    const m = make({ fetchOk: false });
    m.model.findOneAndUpdate
      .mockResolvedValueOnce({})
      .mockReturnValueOnce(Promise.reject(new Error('mongo down')));
    await expect(m.svc.processDocument(payload())).resolves.toBeUndefined();
    expect(m.publisher.publishToChannel).toHaveBeenCalledWith(
      'kb:status:doc-1',
      expect.objectContaining({ type: 'KB_ERROR' }),
    );
  });

  it('never throws when publishing KB_ERROR fails', async () => {
    const m = make({ fetchOk: false });
    m.publisher.publishToChannel.mockRejectedValue(new Error('redis down'));
    await expect(m.svc.processDocument(payload())).resolves.toBeUndefined();
  });

  describe('SSRF guard on fileUrl', () => {
    it.each([
      ['cloud metadata IP', 'http://169.254.169.254/api/uploads/x', 'restricted host'],
      ['GCP metadata host', 'http://metadata.google.internal/api/uploads/x', 'restricted host'],
      ['Alibaba metadata', 'http://100.100.100.200/api/uploads/x', 'restricted host'],
      ['loopback', 'http://127.0.0.1:8080/api/uploads/x', 'private IP'],
      ['RFC1918 10/8', 'http://10.0.0.5/api/uploads/x', 'private IP'],
      ['RFC1918 172.16/12', 'http://172.20.1.1/api/uploads/x', 'private IP'],
      ['RFC1918 192.168/16', 'http://192.168.1.10/api/uploads/x', 'private IP'],
      ['link-local', 'http://169.254.1.1/api/uploads/x', 'private IP'],
      ['non-http scheme', 'ftp://files.example.com/api/uploads/x', 'scheme ftp:'],
      ['path outside uploads', 'https://files.example.com/etc/passwd', 'path must be /api/uploads/*'],
      ['unparseable URL', 'not a url', 'Invalid fileUrl'],
    ])('blocks %s without fetching', async (_label, fileUrl, errorPart) => {
      const m = make();
      await expectError(m, payload({ fileUrl }), errorPart);
      expect(m.fetchMock).not.toHaveBeenCalled();
    });

    it('allows a public https upload URL', async () => {
      const m = make();
      await m.svc.processDocument(payload({ fileUrl: 'https://files.example.com/api/uploads/x' }));
      expect(m.fetchMock).toHaveBeenCalledWith('https://files.example.com/api/uploads/x', {
        headers: {},
        redirect: 'error',
      });
    });

    it.each([
      ['localhost', 'http://localhost:3001/api/uploads/x'],
      ['localhost with trailing root dot', 'http://localhost.:3001/api/uploads/x'],
      ['a *.localhost name', 'http://api.localhost/api/uploads/x'],
    ])('blocks %s in production', async (_label, fileUrl) => {
      process.env.NODE_ENV = 'production';
      const m = make();
      await expectError(m, payload({ fileUrl }), 'private IP');
      expect(m.fetchMock).not.toHaveBeenCalled();
    });

    it('allows localhost outside production (local dev) but still enforces the path', async () => {
      process.env.NODE_ENV = 'development';
      const ok = make();
      await ok.svc.processDocument(payload({ fileUrl: 'http://localhost:8080/api/uploads/x' }));
      expect(ok.fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/uploads/x', expect.anything());

      const bad = make();
      await expectError(bad, payload({ fileUrl: 'http://localhost:8080/admin' }), 'path must be /api/uploads/*');
      expect(bad.fetchMock).not.toHaveBeenCalled();
    });

    it('a trailing root dot does not bypass the metadata host list', async () => {
      const m = make();
      await expectError(m, payload({ fileUrl: 'http://metadata.google.internal./api/uploads/x' }), 'restricted host');
      expect(m.fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ['IPv6 loopback', 'http://[::1]:8080/api/uploads/x'],
      ['IPv6 unspecified', 'http://[::]/api/uploads/x'],
      ['IPv6 ULA fd00::/8', 'http://[fd12::1]/api/uploads/x'],
      ['IPv6 ULA fc00::/8', 'http://[fc00::1]/api/uploads/x'],
      ['IPv6 link-local', 'http://[fe80::1]/api/uploads/x'],
      ['IPv4-mapped loopback', 'http://[::ffff:127.0.0.1]/api/uploads/x'],
      ['IPv4-mapped RFC1918', 'http://[::ffff:10.0.0.5]/api/uploads/x'],
      ['IPv4 0.0.0.0', 'http://0.0.0.0/api/uploads/x'],
    ])('blocks %s', async (_label, fileUrl) => {
      const m = make();
      await expectError(m, payload({ fileUrl }), 'private IP');
      expect(m.fetchMock).not.toHaveBeenCalled();
    });

    it('IPv4-mapped cloud metadata IP is blocked too', async () => {
      const m = make();
      await expectError(m, payload({ fileUrl: 'http://[::ffff:169.254.169.254]/api/uploads/x' }), 'private IP');
      expect(m.fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ['a public IPv6 host', 'http://[2001:db8::1]/api/uploads/x'],
      ['a domain that merely starts with "fd"', 'https://fdroid.example.com/api/uploads/x'],
    ])('allows %s', async (_label, fileUrl) => {
      const m = make();
      await m.svc.processDocument(payload({ fileUrl }));
      expect(m.fetchMock).toHaveBeenCalledWith(fileUrl, expect.anything());
    });
  });
});

describe('KbProcessorService.getReadyDocumentIds — retrieval scope', () => {
  it('a department chat sees only that department’s finished documents', async () => {
    const m = make({ findResult: [{ documentId: 'a' }, { documentId: 'b' }] });
    await expect(m.svc.getReadyDocumentIds('conv-1', 'dept-1')).resolves.toEqual(['a', 'b']);
    expect(m.model.find).toHaveBeenCalledWith({ departmentId: 'dept-1', status: 'done' });
    expect(m.findChain.select).toHaveBeenCalledWith('documentId');
  });

  it('any other chat sees only its own conversation’s finished documents', async () => {
    const m = make({ findResult: [] });
    await expect(m.svc.getReadyDocumentIds('conv-1')).resolves.toEqual([]);
    expect(m.model.find).toHaveBeenCalledWith({ conversationId: 'conv-1', status: 'done' });
  });
});

describe('KbProcessorService.getFileNames', () => {
  it('dedupes ids, skips empty ids and omits records without a file name', async () => {
    const m = make({
      findResult: [
        { documentId: 'a', fileName: 'a.pdf' },
        { documentId: 'b', fileName: '' },
      ],
    });
    const out = await m.svc.getFileNames(['a', 'a', '', 'b']);
    expect(m.model.find).toHaveBeenCalledWith({ documentId: { $in: ['a', 'b'] } });
    expect([...out.entries()]).toEqual([['a', 'a.pdf']]);
  });

  it('skips the query entirely for no ids', async () => {
    const m = make();
    await expect(m.svc.getFileNames(['', ''])).resolves.toEqual(new Map());
    expect(m.model.find).not.toHaveBeenCalled();
  });

  it('returns an empty map on a lookup error (fail-soft)', async () => {
    const m = make({ findError: new Error('mongo down') });
    await expect(m.svc.getFileNames(['a'])).resolves.toEqual(new Map());
  });
});
