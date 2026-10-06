import { isIP } from 'node:net';

/**
 * Client-IP resolution for everything auth-service keys on an address (the throttler today).
 *
 * In production every request arrives through a reverse proxy, so the socket peer — and, with
 * Express' default `trust proxy = false`, `req.ip` — is the proxy, for every user at once. The
 * whole company then shares ONE rate-limit bucket (5 logins/min for everybody).
 *
 * Two knobs, both off by default (local dev / direct exposure keep today's behaviour):
 *
 *   CLIENT_IP_HEADER  name of a header a TRUSTED proxy in front sets to the real client address
 *                     and overwrites when a client sends it (Cloudflare: `cf-connecting-ip`).
 *                     Only set it when nothing can reach the service without passing through
 *                     that proxy — otherwise a client can choose its own bucket.
 *   TRUST_PROXY       Express `trust proxy` (hop count such as `1`, or an Express-supported
 *                     string: `loopback`, `uniquelocal`, a CIDR list…). With it Express derives
 *                     `req.ip` from X-Forwarded-For, honouring only that many trusted hops, so a
 *                     spoofed X-Forwarded-For from the client is ignored.
 */

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

/** Lower-cased header name from CLIENT_IP_HEADER, or undefined when unset/blank. */
export function clientIpHeaderName(
  raw: string | undefined = process.env.CLIENT_IP_HEADER,
): string | undefined {
  const name = raw?.trim().toLowerCase();
  return name ? name : undefined;
}

/**
 * The address to key per-client limits on: the configured header's first value when present and
 * a syntactically valid IP, else `req.ip` (which already reflects TRUST_PROXY), else the socket.
 */
export function resolveClientIp(
  req: RequestLike,
  headerName: string | undefined = clientIpHeaderName(),
): string {
  if (headerName) {
    const raw = req.headers?.[headerName];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const first = typeof value === 'string' ? value.split(',')[0].trim() : '';
    if (first && isIP(first)) return first;
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Parse TRUST_PROXY into an Express `trust proxy` value. `undefined` = leave Express' default
 * (false) untouched. Digits → hop count; 'true'/'false' → boolean; anything else is passed
 * through (Express accepts preset names and comma-separated addresses/CIDRs).
 */
export function parseTrustProxy(
  raw: string | undefined,
): boolean | number | string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}

/** Apply TRUST_PROXY to an Express(-backed) app. Returns the value applied, if any. */
export function applyTrustProxy(
  app: { set(setting: string, value: unknown): unknown },
  raw: string | undefined = process.env.TRUST_PROXY,
): boolean | number | string | undefined {
  const value = parseTrustProxy(raw);
  if (value !== undefined) app.set('trust proxy', value);
  return value;
}
