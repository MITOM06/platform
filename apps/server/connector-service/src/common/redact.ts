/**
 * Log/audit-safe rendering of a URL that may carry credentials.
 *
 * Custom MCP and directory URLs routinely embed API keys — in the userinfo, the
 * query string, or a path segment (`https://host/mcp/sk-live-…/sse`) — so they
 * must never be logged, audited or echoed back verbatim. This keeps the parts a
 * human needs to recognise the server (scheme, host, port, the shape of the
 * path, the query parameter NAMES) and masks everything that could be a secret.
 */
export function redactUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return '[invalid url]';
  }
  const path = url.pathname
    .split('/')
    .map((segment) => (looksSecret(segment) ? '***' : segment))
    .join('/');
  const names = [...new Set(url.searchParams.keys())];
  const query = names.length
    ? `?${names.map((n) => `${encodeURIComponent(n)}=***`).join('&')}`
    : '';
  // `host` carries the port but never the userinfo; the fragment is dropped.
  return `${url.protocol}//${url.host}${path}${query}`;
}

/** Heuristic: long or mixed letter/digit path segments are treated as secrets. */
function looksSecret(segment: string): boolean {
  let s = segment;
  try {
    s = decodeURIComponent(segment);
  } catch {
    // keep the raw segment
  }
  if (s.length >= 32) return true;
  if (s.length >= 16 && /\d/.test(s) && /[a-z]/i.test(s)) return true;
  return s.length >= 8 && /^(sk|pk|rk|key|tok|token|secret|api|bearer)[-_]/i.test(s);
}
