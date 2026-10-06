/**
 * chat-service upload ids: a random UUID (current uploads) or a 24-hex GridFS
 * ObjectId (legacy uploads) — the only two forms `GET /api/uploads/{id}` serves.
 */
const UPLOAD_ID_RE =
  /^(?:[0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** `/api/uploads/{id}` at the end of a path (a gateway may prefix it, e.g. `/chat/api/uploads/{id}`). */
const UPLOAD_PATH_RE = /(?:^|\/)api\/uploads\/([^/]+)$/;

/**
 * Map a chat media reference to the internal chat-service URL its bytes may be
 * fetched from — or null when it is not a chat upload.
 *
 * Accepted: the relative `/api/uploads/{id}` chat-service hands out, and an
 * absolute http(s) URL whose path ends in `/api/uploads/{id}`. In both cases the
 * id is re-anchored on `internalBase` and the ref's own host is DISCARDED, so a
 * message can never make ai-service request an arbitrary URL (blind SSRF into
 * metadata endpoints / internal hosts). External image links are rejected.
 */
export function resolveUploadUrl(ref: unknown, internalBase: string): string | null {
  if (typeof ref !== 'string') return null;
  const trimmed = ref.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  let path: string;
  if (trimmed.startsWith('/')) {
    // `//host/...` is protocol-relative — an external host, not a path.
    if (trimmed.startsWith('//')) return null;
    path = trimmed.split(/[?#]/, 1)[0];
  } else {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    path = url.pathname;
  }

  const match = UPLOAD_PATH_RE.exec(path);
  if (!match || !UPLOAD_ID_RE.test(match[1])) return null;
  return `${internalBase.replace(/\/+$/, '')}/api/uploads/${match[1].toLowerCase()}`;
}
