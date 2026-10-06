import type { Query, QueryClient } from '@tanstack/react-query'
import { isAuthFailure, refreshAccessToken } from '@/lib/api/axios'
import { forceLogout } from '@/lib/auth/force-logout'
import { useAuthStore } from '@/lib/store/auth.store'
import { stompService } from '@/lib/stomp/client'

/**
 * Query roots whose content depends on my role / departments / permissions. After
 * CLAIMS_CHANGED they are refetched so menus and admin screens show / hide at once.
 */
const CLAIM_SCOPED_ROOTS = new Set([
  'me-capabilities',
  'ai-context',
  'connections',
  'connector-catalog',
  'connector-directory',
  'skills',
  'external-bots',
])

export function isClaimScopedQuery(query: Pick<Query, 'queryKey'>): boolean {
  const root = query.queryKey[0]
  return typeof root === 'string' && (CLAIM_SCOPED_ROOTS.has(root) || root.startsWith('admin-'))
}

let inFlight: Promise<void> | null = null

/**
 * `CLAIMS_CHANGED` (F1): an admin changed my role / departments / a role's matrix.
 * Nothing is "logged out": refresh the token (it is minted with the fresh claims),
 * refetch the capability-scoped queries, then reconnect STOMP so the socket carries
 * the new token. A transient refresh failure keeps the session — the next request's
 * 401 `TOKEN_CLAIMS_STALE` retries the refresh; only a rejected refresh logs out.
 * Single-flight: duplicate events (one per chat-service instance) share one run.
 */
export function refreshClaims(queryClient: QueryClient): Promise<void> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const token = await refreshAccessToken()
      const { user, setAuth } = useAuthStore.getState()
      if (user) setAuth(user, token)
    } catch (err) {
      if (isAuthFailure(err)) await forceLogout(err)
      return
    }
    // Not awaited: a slow refetch must not delay the socket reconnect.
    void queryClient.invalidateQueries({ predicate: isClaimScopedQuery })
    stompService.reconnect()
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}
