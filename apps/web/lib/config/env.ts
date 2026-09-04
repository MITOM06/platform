/**
 * Where the web app talks to the backend — one place, one rule.
 *
 * Promoting a build between environments should be a configuration change, never
 * a code change, so every base URL is resolved here from the environment in a
 * fixed order of precedence:
 *
 *   1. `NEXT_PUBLIC_<SERVICE>_URL` — one service pointed somewhere of its own.
 *      Kept for split deployments and for pointing a single service at a local
 *      instance while the rest stay remote.
 *   2. `NEXT_PUBLIC_API_BASE` — the whole backend behind one host, routed by the
 *      reverse proxy (`/api/auth`, `/api/chat`, `/api/ai`, `/api/connector`, `/ws`).
 *      That is the Caddy + Cloudflare Tunnel deployment and the self-host stack,
 *      and it mirrors the mobile client's `PON_DOMAIN`, so both clients now
 *      switch environments by changing exactly one value.
 *   3. Nothing set — same-origin relative paths, correct when the web app is
 *      served by that same reverse proxy.
 *
 * Nothing here may name a host. A hardcoded production host is invisible when you
 * run locally: the app just quietly talks to production
 * (`scripts/ci/check-env-leaks.sh` fails the build over it).
 */

const trimSlash = (v: string) => v.replace(/\/+$/, '');

/** Proxy path each service is served under when one host fronts them all. */
const PROXY_PATH = {
  auth: '/api/auth',
  chat: '/api/chat',
  ai: '/api/ai',
  connector: '/api/connector',
} as const;

export type Service = keyof typeof PROXY_PATH;

/** Backend root when the whole API sits behind one host. Empty when unset. */
export function apiBase(): string {
  return trimSlash(process.env.NEXT_PUBLIC_API_BASE ?? '');
}

/**
 * Resolved at call time rather than captured at import, so tests (and any code
 * that sets the environment late) see what they set. In a real build Next.js has
 * already inlined these values, so this is a constant either way.
 */
export function serviceUrl(service: Service): string {
  const explicit = {
    auth: process.env.NEXT_PUBLIC_AUTH_URL,
    chat: process.env.NEXT_PUBLIC_CHAT_URL,
    ai: process.env.NEXT_PUBLIC_AI_URL,
    connector: process.env.NEXT_PUBLIC_CONNECTOR_URL,
  }[service];
  if (explicit) return trimSlash(explicit);
  const base = apiBase();
  return base ? `${base}${PROXY_PATH[service]}` : PROXY_PATH[service];
}

/** True when the resolved URL is the same-origin fallback, not a real host. */
export const isRelative = (url: string) => url.startsWith('/');

// Convenience constants for module-level consumers (axios instances, CSP in
// next.config.ts) that need a value at import time.
export const AUTH_URL = serviceUrl('auth');
export const CHAT_URL = serviceUrl('chat');
export const AI_URL = serviceUrl('ai');
export const CONNECTOR_URL = serviceUrl('connector');

/**
 * STOMP endpoint. `NEXT_PUBLIC_WS_URL` wins; otherwise derive `wss://<host>/ws`
 * from `NEXT_PUBLIC_API_BASE`. Returns undefined when neither is set — the caller
 * falls back to the page origin, which is right for single-origin self-host and
 * wrong (loudly) on a dev machine.
 */
export function wsUrlFromEnv(): string | undefined {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const base = apiBase();
  if (!base) return undefined;
  try {
    const { protocol, host } = new URL(base);
    return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`;
  } catch {
    return undefined;
  }
}

/**
 * Absolute auth-service URL for code running on the server (route handlers).
 *
 * A relative base is fine in the browser and meaningless in Node, so when the
 * same-origin fallback is in play, resolve it against the incoming request's
 * origin — which is exactly the reverse proxy fronting both the web app and
 * auth-service in a single-domain deployment.
 */
export function serverAuthUrl(requestUrl: string): string {
  const url = serviceUrl('auth');
  if (!isRelative(url)) return url;
  return `${trimSlash(new URL(requestUrl).origin)}${url}`;
}

/**
 * True when this build has no idea where the backend is and is relying on the
 * relative-path fallback. Only correct when the web app and the API share an
 * origin; anywhere else (Vercel in front of a separate backend) it means the
 * environment was never configured.
 */
export const usesSameOriginFallback = !apiBase() && !process.env.NEXT_PUBLIC_AUTH_URL;
