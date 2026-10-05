import { promises as dns } from 'dns';
import { BadRequestException } from '@nestjs/common';
import { isBlockedIp, isIpLiteral } from './ip-ranges';

/**
 * Outbound-request (SSRF) guard shared by every server-side fetch whose target
 * an admin, a directory entry or a remote server's metadata can influence:
 * custom MCP URLs, directory MCP / authorize / token URLs, MCP OAuth discovery
 * (issuer, registration and token endpoints) and the MCP transports.
 *
 * Rules (production):
 *  - https only; no credentials in the URL;
 *  - no single-label (`chat-service`, `qdrant`, `localhost`) or internal-suffix
 *    (`.internal`, `.local`, `.localhost`, `.home.arpa`, `.lan`, `.intranet`) hosts;
 *  - IP literals and every DNS answer must be public unicast (no loopback,
 *    RFC 1918, link-local/metadata, ULA, CGNAT, multicast, reserved);
 *  - redirects are followed manually and every hop is re-checked.
 *
 * Local development: when NODE_ENV !== 'production', hosts listed in
 * CONNECTOR_DEV_ALLOW_HOSTS (comma-separated) may use http and skip the IP
 * checks. The variable is ignored in production.
 *
 * Known limitation: DNS is resolved for the check and again by fetch, so a
 * DNS-rebinding attacker controlling a public zone could still race the two
 * lookups. Closing that needs a pinned-IP dispatcher (undici Agent) — not done
 * to avoid adding a dependency.
 */
export class UnsafeUrlError extends BadRequestException {
  constructor(readonly reason: string) {
    // Never include the URL itself: it may carry an API key.
    super({ code: 'UNSAFE_URL', reason });
    this.name = 'UnsafeUrlError';
  }
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

/** Indirection so tests can stub DNS without touching the network. */
export const resolver = {
  lookup: (hostname: string): Promise<ResolvedAddress[]> =>
    dns.lookup(hostname, { all: true, verbatim: true }),
};

export type GuardEnv = Record<string, string | undefined>;

const INTERNAL_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan', '.intranet'];
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const CREDENTIAL_HEADERS = ['authorization', 'proxy-authorization', 'cookie', 'x-api-key'];
const MAX_REDIRECTS = 5;

/** Dev-only hosts allowed to bypass the guard (empty in production). */
export function devAllowedHosts(env: GuardEnv = process.env): ReadonlySet<string> {
  if (env.NODE_ENV === 'production') return new Set();
  return new Set(
    (env.CONNECTOR_DEV_ALLOW_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

function bareHost(url: URL): string {
  const host = url.hostname.toLowerCase();
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

/**
 * Synchronous checks that need no DNS. Throws {@link UnsafeUrlError}. Returns
 * the parsed URL and whether the host is a dev allow-listed exception.
 */
export function checkUrlSyntax(
  raw: string | URL,
  env: GuardEnv = process.env,
): { url: URL; devAllowed: boolean } {
  let url: URL;
  try {
    url = raw instanceof URL ? new URL(raw.toString()) : new URL(raw);
  } catch {
    throw new UnsafeUrlError('malformed URL');
  }
  if (url.username || url.password) throw new UnsafeUrlError('credentials in URL');
  const host = bareHost(url);
  const devAllowed = devAllowedHosts(env).has(host);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && devAllowed)) {
    throw new UnsafeUrlError('https required');
  }
  if (devAllowed) return { url, devAllowed };
  if (isIpLiteral(host)) {
    if (isBlockedIp(host)) throw new UnsafeUrlError('private address');
    return { url, devAllowed };
  }
  const name = host.endsWith('.') ? host.slice(0, -1) : host;
  if (!name.includes('.')) throw new UnsafeUrlError('single-label host');
  if (INTERNAL_SUFFIXES.some((s) => name.endsWith(s))) {
    throw new UnsafeUrlError('internal hostname');
  }
  return { url, devAllowed };
}

/** Full check: syntax + every DNS answer must be a public address. */
export async function assertSafeUrl(raw: string | URL, env: GuardEnv = process.env): Promise<URL> {
  const { url, devAllowed } = checkUrlSyntax(raw, env);
  const host = bareHost(url);
  if (devAllowed || isIpLiteral(host)) return url;
  let answers: ResolvedAddress[];
  try {
    answers = await resolver.lookup(host);
  } catch {
    throw new UnsafeUrlError('unresolvable host');
  }
  if (!answers?.length) throw new UnsafeUrlError('unresolvable host');
  if (answers.some((a) => isBlockedIp(a.address))) {
    throw new UnsafeUrlError('private address');
  }
  return url;
}

function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input && typeof (input as { url?: unknown }).url === 'string') {
    return (input as { url: string }).url;
  }
  return String(input);
}

/**
 * `fetch` with the guard applied to the target and to every redirect hop.
 * Mirrors the WHATWG redirect rules we rely on: 303 (and 301/302 after POST)
 * become a body-less GET, and credential headers are dropped when a redirect
 * changes origin. Drop-in for the MCP SDK's `fetch` option.
 */
export async function safeFetch(input: unknown, init: RequestInit = {}): Promise<Response> {
  let current = requestUrl(input);
  let method = (init.method ?? 'GET').toUpperCase();
  let body = init.body;
  const headers = new Headers(init.headers as HeadersInit | undefined);
  for (let hop = 0; ; hop++) {
    const url = await assertSafeUrl(current);
    const res = await fetch(url.toString(), {
      ...init,
      method,
      body,
      headers,
      redirect: 'manual',
    });
    const location = REDIRECT_STATUSES.has(res.status) ? res.headers.get('location') : null;
    if (!location) return res;
    if (hop >= MAX_REDIRECTS) throw new UnsafeUrlError('too many redirects');
    const next = new URL(location, url);
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
      if (method !== 'HEAD') method = 'GET';
      body = undefined;
      headers.delete('content-type');
      headers.delete('content-length');
    }
    if (next.origin !== url.origin) {
      for (const h of CREDENTIAL_HEADERS) headers.delete(h);
    }
    try {
      await res.body?.cancel();
    } catch {
      // nothing to drain
    }
    current = next.toString();
  }
}
