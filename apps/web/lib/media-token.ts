// Media token for `/api/uploads/{id}?t=…` URLs. In memory only (never localStorage).
// Fetched during session bootstrap, refreshed when < 1h remains, cleared on sign-out.
import { create } from 'zustand'
import { chatService } from '@/lib/api/chat'
import { useAuthStore } from '@/lib/store/auth.store'

const REFRESH_WHEN_LEFT_MS = 60 * 60 * 1000
const MIN_REFRESH_DELAY_MS = 60 * 1000
const RETRY_DELAY_MS = 15 * 1000
export const BOOTSTRAP_WAIT_MS = 5000

interface MediaTokenState {
  token: string | null
  expiresAt: number | null
}

export const useMediaTokenStore = create<MediaTokenState>(() => ({ token: null, expiresAt: null }))

let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<void> | null = null

function schedule(delayMs: number) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void ensureMediaToken()
  }, delayMs)
}

function isFresh(): boolean {
  const { token, expiresAt } = useMediaTokenStore.getState()
  return !!token && expiresAt !== null && expiresAt - Date.now() > REFRESH_WHEN_LEFT_MS
}

/** Fetch the token unless the current one still has >= 1h left. Never rejects; retries in the background. */
export function ensureMediaToken(): Promise<void> {
  if (isFresh()) return Promise.resolve()
  if (!useAuthStore.getState().accessToken) return Promise.resolve()
  if (inflight) return inflight
  inflight = chatService
    .getMediaToken()
    .then((res) => {
      const expiresAt = Date.parse(res.expiresAt)
      if (!res.token || Number.isNaN(expiresAt)) throw new Error('bad media token response')
      // Signed out while the request was in flight: drop it.
      if (!useAuthStore.getState().accessToken) return
      useMediaTokenStore.setState({ token: res.token, expiresAt })
      schedule(Math.max(expiresAt - Date.now() - REFRESH_WHEN_LEFT_MS, MIN_REFRESH_DELAY_MS))
    })
    .catch(() => {
      // Never surface an error: plain URLs keep working while the flag is off.
      if (useAuthStore.getState().accessToken) schedule(RETRY_DELAY_MS)
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Session bootstrap helper: wait for the token, but never longer than `ms`. */
export function ensureMediaTokenBounded(ms = BOOTSTRAP_WAIT_MS): Promise<void> {
  return Promise.race([
    ensureMediaToken(),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ])
}

export function clearMediaToken(): void {
  if (timer) clearTimeout(timer)
  timer = null
  useMediaTokenStore.setState({ token: null, expiresAt: null })
}

/** Current token for URL building, or null (not fetched yet / signed out). */
export function getMediaToken(): string | null {
  return useMediaTokenStore.getState().token
}

// Every sign-out path (performLogout, forceLogout, SessionInitializer) ends in clearAuth().
useAuthStore.subscribe((s, prev) => {
  if (prev.accessToken && !s.accessToken) clearMediaToken()
})
