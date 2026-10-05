import axios from 'axios'

/**
 * connector-service error codes → `integrations.*` message keys (HANDOFF §5.4).
 * The server's `message` text is English diagnostics and never reaches the UI.
 */

/** Codes the OAuth callback puts in `?error=<CODE>&provider=<slug>`. */
const CALLBACK_ERROR_KEYS: Record<string, string> = {
  ACCESS_DENIED: 'oauthErrAccessDenied',
  PROVIDER_ERROR: 'oauthErrProvider',
  MISSING_CODE: 'oauthErrMissingCode',
  STATE_INVALID: 'oauthErrStateInvalid',
  STATE_EXPIRED: 'oauthErrStateExpired',
  CONNECTOR_UNAVAILABLE: 'errConnectorUnavailable',
  CONNECTOR_NOT_ALLOWED: 'errConnectorNotAllowed',
  INSUFFICIENT_PERMISSION: 'errInsufficientPermission',
  EXCHANGE_FAILED: 'oauthErrExchangeFailed',
  INTERNAL_ERROR: 'oauthErrInternal',
}

/** Localized key of an OAuth callback `?error=` code; unknown codes get the generic one. */
export function oauthCallbackErrorKey(code: string | null | undefined): string {
  return (code && CALLBACK_ERROR_KEYS[code]) || 'oauthErrInternal'
}

/** What the OAuth return URL (`?connected=` / `?error=&provider=`) says. */
export interface OAuthReturn {
  connected?: string
  error?: string
  provider?: string
}

const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/
const CODE = /^[A-Z_]{1,64}$/

/**
 * Parse the query of the page the provider sent the browser back to. Values are
 * validated (slug / code shapes) so nothing arbitrary is ever echoed.
 */
export function parseOAuthReturn(search: string | URLSearchParams): OAuthReturn | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const connected = params.get('connected')
  const error = params.get('error')
  const provider = params.get('provider')
  if (connected && SLUG.test(connected)) return { connected }
  if (error) {
    return {
      error: CODE.test(error) ? error : 'INTERNAL_ERROR',
      ...(provider && SLUG.test(provider) ? { provider } : {}),
    }
  }
  return null
}

/** REST error codes (OAuth start, connect-key, disconnect, custom MCP). */
const REST_ERROR_KEYS: Record<string, string> = {
  INSUFFICIENT_PERMISSION: 'errInsufficientPermission',
  CONNECTOR_NOT_ALLOWED: 'errConnectorNotAllowed',
  CONNECTOR_UNAVAILABLE: 'errConnectorUnavailable',
  UNSAFE_URL: 'errUnsafeUrl',
  OAUTH_DISCOVERY_FAILED: 'errOauthDiscoveryFailed',
  DCR_UNSUPPORTED: 'errDcrUnsupported',
  DCR_FAILED: 'errDcrFailed',
  INVALID_ENV_OAUTH: 'errEnvOauthNotConfigured',
  ENV_OAUTH_NOT_CONFIGURED: 'errEnvOauthNotConfigured',
  MCP_DISCOVERY_FAILED: 'customDiscoverError',
}

/** `integrations.*` key for a failed connector-service call; [fallbackKey] when unknown. */
export function connectorErrorKey(err: unknown, fallbackKey: string): string {
  if (!axios.isAxiosError(err)) return fallbackKey
  if (!err.response) return 'errNetwork'
  const code = (err.response.data as { code?: unknown } | undefined)?.code
  if (typeof code === 'string' && REST_ERROR_KEYS[code]) return REST_ERROR_KEYS[code]
  if (err.response.status === 403) return 'errInsufficientPermission'
  if (err.response.status === 429) return 'errRateLimited'
  return fallbackKey
}
