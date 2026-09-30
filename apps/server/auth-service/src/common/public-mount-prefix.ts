/**
 * The path this service is published under, as seen by the browser.
 *
 * Reverse proxies that mount the service on a sub-path can either pass the full
 * path through or strip it first. Caddy's `handle_path` — what the Mac mini
 * deployment uses to serve auth-service at `/api/auth` — strips, so a
 * server-generated root-relative URL like `/auth/google` would resolve against
 * the host root and hit a path the proxy does not route. Proxies advertise the
 * stripped segment in `X-Forwarded-Prefix`; prepending it makes those URLs
 * resolve correctly again.
 *
 * Returns '' when the header is absent (service mounted at the host root, e.g.
 * Cloud Run or local dev) or when the value is not a plain absolute path, so a
 * spoofed header can never bounce the browser to another origin.
 */
export function publicMountPrefix(req: {
  headers?: Record<string, unknown>;
}): string {
  const raw = req?.headers?.['x-forwarded-prefix'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return '';

  const prefix = value.endsWith('/') ? value.slice(0, -1) : value;
  // A single leading slash followed by safe path characters. This rejects
  // protocol-relative values ('//evil.example.com'), absolute URLs and '..'
  // traversal — all of which would otherwise redirect off-host.
  if (!/^\/[A-Za-z0-9._~\-]+(?:\/[A-Za-z0-9._~\-]+)*$/.test(prefix)) return '';
  if (prefix.split('/').includes('..')) return '';

  return prefix;
}
