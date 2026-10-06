import type { DirectoryAuthMode } from '@/lib/api/connector-types'

/**
 * Localized labels for connector metadata that the server sends as machine
 * values: OAuth scopes are full URLs (`https://www.googleapis.com/auth/gmail.send`)
 * and auth modes are slugs (`env-oauth`). Unknown scopes are hidden, never shown raw.
 */

const SCOPE_KEYS: Array<[RegExp, string]> = [
  [/gmail\.send$/, 'scopeSendEmail'],
  [/gmail\.compose$/, 'scopeDraftEmail'],
  [/gmail\.(readonly|metadata)$/, 'scopeReadEmail'],
  [/gmail\.modify$/, 'scopeManageEmail'],
  [/calendar\.events$/, 'scopeManageEvents'],
  [/calendar(\.events)?\.readonly$/, 'scopeReadCalendar'],
  [/calendar$/, 'scopeManageEvents'],
  [/drive\.readonly$/, 'scopeReadFiles'],
  [/drive(\.file)?$/, 'scopeManageFiles'],
  [/^read_content$/, 'scopeReadContent'],
  [/^update_content$/, 'scopeUpdateContent'],
  [/^insert_content$/, 'scopeInsertContent'],
]

/** `integrations.*` key of an OAuth scope, or null when it has no friendly label. */
export function scopeLabelKey(scope: string): string | null {
  for (const [re, key] of SCOPE_KEYS) {
    if (re.test(scope)) return key
  }
  return null
}

/** Distinct friendly labels of a scope list (duplicates collapse, unknowns drop). */
export function scopeLabelKeys(scopes: readonly string[]): string[] {
  return [...new Set(scopes.map(scopeLabelKey).filter((k): k is string => !!k))]
}

const AUTH_MODE_KEYS: Record<DirectoryAuthMode, string> = {
  'mcp-oauth': 'authModeOauth',
  'env-oauth': 'authModeOauth',
  apikey: 'authModeApiKey',
  none: 'authModeNone',
}

/** `integrations.*` key of a directory auth mode. */
export function authModeLabelKey(mode: string): string {
  return AUTH_MODE_KEYS[mode as DirectoryAuthMode] ?? 'authModeOther'
}

const ADMIN_AUTH_MODE_KEYS: Record<DirectoryAuthMode, string> = {
  'mcp-oauth': 'authModeMcpOauth',
  'env-oauth': 'authModeEnvOauth',
  apikey: 'authModeApiKey',
  none: 'authModeNone',
}

/** Admin form label of an auth mode — distinguishes the two OAuth variants. */
export function adminAuthModeLabelKey(mode: DirectoryAuthMode): string {
  return ADMIN_AUTH_MODE_KEYS[mode]
}
