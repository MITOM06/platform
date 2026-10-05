import { BadRequestException, HttpException } from '@nestjs/common';

/**
 * Codes the OAuth callbacks put in `?error=<CODE>&provider=<slug>` on the client
 * redirect. Clients localize them; nothing else (no provider body, no exception
 * text) ever reaches the popup.
 */
export const OAUTH_CALLBACK_ERROR_CODES = [
  'ACCESS_DENIED', // the user declined consent at the provider (?error=access_denied)
  'PROVIDER_ERROR', // the provider redirected back with any other ?error=
  'MISSING_CODE', // no authorization code and no provider error
  'STATE_INVALID', // malformed / tampered / wrong-provider state
  'STATE_EXPIRED', // state older than the 10-minute TTL
  'CONNECTOR_UNAVAILABLE', // connector or directory entry unknown / disabled
  'CONNECTOR_NOT_ALLOWED', // blocked by the workspace allow-list
  'INSUFFICIENT_PERMISSION', // member lost the capability / was blocked mid-flow
  'EXCHANGE_FAILED', // token exchange with the provider failed
  'INTERNAL_ERROR', // anything unexpected
] as const;

export type OAuthCallbackErrorCode = (typeof OAUTH_CALLBACK_ERROR_CODES)[number];

const CALLBACK_CODES: ReadonlySet<string> = new Set(OAUTH_CALLBACK_ERROR_CODES);

/** A coded OAuth-flow failure. As an HTTP error its body is `{ code, ...extra }`. */
export class OAuthFlowError extends BadRequestException {
  constructor(
    readonly code: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ code, ...extra });
    this.name = 'OAuthFlowError';
  }
}

/** Token endpoint failure; `oauthError` is the RFC 6749 `error` code (never the raw body). */
export class TokenEndpointError extends OAuthFlowError {
  constructor(
    readonly upstreamStatus: number,
    readonly oauthError?: string,
  ) {
    super('EXCHANGE_FAILED', { status: upstreamStatus, ...(oauthError ? { oauthError } : {}) });
    this.name = 'TokenEndpointError';
  }
}

/** Extract a safe RFC 6749 error code from a token endpoint body (`invalid_grant`, …). */
export function parseOAuthErrorCode(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed?.error === 'string' && /^[a-z_]{1,64}$/.test(parsed.error)) {
      return parsed.error;
    }
  } catch {
    // not JSON
  }
  return undefined;
}

/** Map any failure in a callback to the code shown to the client. */
export function callbackErrorCode(err: unknown): OAuthCallbackErrorCode {
  if (err instanceof TokenEndpointError) return 'EXCHANGE_FAILED';
  const code =
    err instanceof OAuthFlowError
      ? err.code
      : err instanceof HttpException
        ? (err.getResponse() as { code?: unknown })?.code
        : undefined;
  if (typeof code === 'string' && CALLBACK_CODES.has(code)) {
    return code as OAuthCallbackErrorCode;
  }
  return 'INTERNAL_ERROR';
}

/** Provider-side `?error=` → client code. */
export function providerErrorCode(error: string): OAuthCallbackErrorCode {
  return error === 'access_denied' ? 'ACCESS_DENIED' : 'PROVIDER_ERROR';
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * `<clientRedirectUrl>?<params>` — keeps any query the configured URL already
 * has. `provider` is dropped unless it is a well-formed slug (it comes from the
 * request path and must never smuggle markup into the client).
 */
export function buildClientRedirect(base: string, params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params).filter(([k, v]) => {
    if (v === undefined || v === '') return false;
    return k !== 'provider' && k !== 'connected' ? true : SLUG.test(v);
  });
  const qs = pairs.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
  if (!qs) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${qs}`;
}
