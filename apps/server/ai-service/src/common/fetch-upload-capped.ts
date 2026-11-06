/** Why a capped upload fetch gave up. */
export type UploadFetchFailure = 'http' | 'too-large' | 'timeout' | 'network';

export class UploadFetchError extends Error {
  constructor(readonly reason: UploadFetchFailure, message: string) {
    super(message);
    this.name = 'UploadFetchError';
  }
}

export interface FetchUploadCappedOptions {
  maxBytes: number;
  /** Covers connect AND the whole body read. */
  timeoutMs: number;
  headers?: Record<string, string>;
}

/**
 * GET an internal upload URL (callers must pass a URL from `resolveUploadUrl`):
 * redirects refused, one timeout over connect + body, size cap enforced on the
 * declared Content-Length and again while streaming — the body is abandoned the
 * moment it passes the cap, never buffered beyond it. Throws UploadFetchError.
 */
export async function fetchUploadCapped(
  url: string,
  { maxBytes, timeoutMs, headers }: FetchUploadCappedOptions,
): Promise<{ body: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error', headers });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new UploadFetchError('http', `HTTP ${response.status}`);
    }
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      throw new UploadFetchError('too-large', `declared ${declared} bytes > cap ${maxBytes}`);
    }
    const body = await readCapped(response, maxBytes);
    return { body, contentType: response.headers.get('content-type') ?? '' };
  } catch (err) {
    if (err instanceof UploadFetchError) throw err;
    if (controller.signal.aborted) throw new UploadFetchError('timeout', `timed out after ${timeoutMs}ms`);
    throw new UploadFetchError('network', (err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new UploadFetchError('too-large', `body exceeds cap ${maxBytes} bytes`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}
