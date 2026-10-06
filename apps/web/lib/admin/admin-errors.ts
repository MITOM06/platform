import { CAPABILITIES, type Capability } from '@/lib/api/admin-types'
import { authCodeToI18nKey, parseAuthError } from '@/lib/auth/auth-error'

type Translate = (key: string, values?: Record<string, string | number>) => string

/** A localized message to show: an `auth.*` key plus its values. */
export interface AdminErrorDescriptor {
  key: string
  values?: Record<string, string | number>
  /** Capabilities the actor lacks (ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS) — to be named. */
  capabilities?: Capability[]
}

function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && (CAPABILITIES as readonly string[]).includes(value)
}

/**
 * Typed auth-service error (`{ code, params }` at the top level) → localized
 * message descriptor for the admin console. Returns null for an unknown failure so
 * the caller can use its own generic text. Never the raw server text.
 */
export function adminErrorDescriptor(err: unknown): AdminErrorDescriptor | null {
  const { code, params } = parseAuthError(err)
  if (code === 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS') {
    const raw = (params as { capabilities?: unknown } | undefined)?.capabilities
    const capabilities = Array.isArray(raw) ? raw.filter(isCapability) : []
    return capabilities.length > 0
      ? { key: 'errRoleGrantExceedsOwnPermissions', capabilities }
      : { key: 'errRoleGrantExceedsOwnPermissionsGeneric' }
  }
  const key = authCodeToI18nKey(code)
  if (key === 'errGeneric') return null
  // Only numeric / string params are interpolated; anything else is dropped.
  const values: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params ?? {})) {
    if (typeof v === 'string' || typeof v === 'number') values[k] = v
  }
  return Object.keys(values).length > 0 ? { key, values } : { key }
}

/** Localized, comma-joined capability names ("Manage roles, View audit log"). */
export function capabilityList(
  capabilities: readonly Capability[],
  tAdmin: Translate,
  locale: string,
): string {
  const names = capabilities.map((c) => tAdmin(`caps.${c}`))
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
  } catch {
    return names.join(', ')
  }
}

/** The final message for an admin mutation failure; [fallback] when unknown. */
export function adminErrorMessage(
  err: unknown,
  tAuth: Translate,
  tAdmin: Translate,
  locale: string,
  fallback: string,
): string {
  const d = adminErrorDescriptor(err)
  if (!d) return fallback
  if (d.capabilities) {
    return tAuth(d.key, { capabilities: capabilityList(d.capabilities, tAdmin, locale) })
  }
  return tAuth(d.key, d.values)
}
