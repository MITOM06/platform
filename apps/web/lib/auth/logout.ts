import axios from 'axios'
import { authService } from '@/lib/api/auth'
import { stompService } from '@/lib/stomp/client'
import { useAuthStore } from '@/lib/store/auth.store'
import { clearQueryCache } from '@/lib/query-client'

/** Never let a slow auth-service hold the user on a "signing out" spinner. */
const LOGOUT_REQUEST_TIMEOUT_MS = 4000

function settleWithin(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    promise.then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      () => {
        clearTimeout(timer)
        resolve()
      },
    )
  })
}

/**
 * User-initiated sign-out (sidebar profile menu, Settings).
 *
 * 1. `POST /auth/logout` revokes the server session — the server takes the sid from
 *    the access token, so the 30-day refresh token dies too (previously it stayed
 *    valid after "logging out").
 * 2. Tear down realtime, wipe the httpOnly cookies and the in-memory auth.
 * 3. Clear the whole query cache, then HARD-navigate to /login so nothing of this
 *    user (conversations, AI context, usage…) survives for the next person.
 *    `?cleared=1` makes the login form drop browser-autofilled credentials.
 */
export async function performLogout(): Promise<void> {
  await settleWithin(authService.logout(), LOGOUT_REQUEST_TIMEOUT_MS)
  stompService.disconnect()
  await axios.post('/api/auth/clear-cookie').catch(() => {})
  useAuthStore.getState().clearAuth()
  clearQueryCache()
  if (typeof window !== 'undefined') window.location.assign('/login?cleared=1')
}
