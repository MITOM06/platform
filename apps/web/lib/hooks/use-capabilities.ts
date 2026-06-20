import { useQuery } from '@tanstack/react-query'
import { adminService } from '@/lib/api/admin'
import { useAuthStore } from '@/lib/store/auth.store'
import type { Capability } from '@/lib/api/admin-types'

/**
 * The caller's resolved RBAC capabilities + workspace config (`/me/capabilities`).
 * Cached for the session and used to gate admin UI. Mirrors Flutter's
 * `capabilitiesProvider`.
 */
export function useCapabilities() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['me-capabilities', userId],
    queryFn: () => adminService.getCapabilities(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}

/** True if the caller holds [cap]. Returns false while loading / unauthenticated. */
export function useHasCapability(cap: Capability): boolean {
  const { data } = useCapabilities()
  return data?.perms.includes(cap) ?? false
}

/** Capabilities that grant access to at least one admin console section. */
export const ADMIN_SECTION_CAPS: Capability[] = [
  'MANAGE_WORKSPACE',
  'MANAGE_DEPARTMENTS',
  'MANAGE_MEMBERS',
  'MANAGE_ROLES',
  'VIEW_AUDIT_LOG',
]

/** True if the caller can see the Admin area at all (holds any section cap). */
export function useCanAccessAdmin(): boolean {
  const { data } = useCapabilities()
  if (!data) return false
  return ADMIN_SECTION_CAPS.some((c) => data.perms.includes(c))
}
