// Media token for `/api/uploads/{id}?t=…` URLs. In memory only (never localStorage).
// Fetched during session bootstrap, refreshed when < 1h remains, cleared on sign-out.
import { create } from 'zustand'
import { chatService } from '@/lib/api/chat'
import { useAuthStore } from '@/lib/store/auth.store'

const REFRESH_WHEN_LEFT_MS = 60 * 60 * 1000
const MIN_REFRESH_DELAY_MS = 60 * 1000
const RETRY_DELAY_MS = 15 * 1000
const RETRY_MAX_MS = 5 * 60 * 1000
export const BOOTSTRAP_WAIT_MS = 5000

interface MediaTokenState {
  token: string | null
  expiresAt: number | null
  /**
   * Bumped each time the token goes from none to a value (a late arrival after the bounded
   * bootstrap wait). Media already rendered without `t` remounts on it; refreshes don't bump.
   */
  epoch: number
}

export const useMediaTokenStore = create<MediaTokenState>(() => ({ token: null, expiresAt: null, epoch: 0 }))

let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<void> | null = null
let retryDelay = RETRY_DELAY_MS
// Bumped on every clear: a response started before a sign-out/re-login is dropped.
let generation = 0

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
  const gen = generation
  const request: Promise<void> = chatService
    .getMediaToken()
    .then((res) => {
      const expiresAt = Date.parse(res.expiresAt)
      if (!res.token || Number.isNaN(expiresAt)) throw new Error('bad media token response')
      // Signed out (or another user signed in) while in flight: drop it.
      if (gen !== generation || !useAuthStore.getState().accessToken) return
      retryDelay = RETRY_DELAY_MS
      useMediaTokenStore.setState((s) => ({
        token: res.token,
        expiresAt,
        epoch: s.token ? s.epoch : s.epoch + 1,
      }))
      schedule(Math.max(expiresAt - Date.now() - REFRESH_WHEN_LEFT_MS, MIN_REFRESH_DELAY_MS))
    })
    .catch(() => {
      // Never surface an error: plain URLs keep working while the flag is off.
      if (gen !== generation || !useAuthStore.getState().accessToken) return
      schedule(retryDelay)
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS)
    })
    .finally(() => {
      if (inflight === request) inflight = null
    })
  inflight = request
  return request
}

/** Session bootstrap helper: wait for the token, but never longer than `ms`. */
export function ensureMediaTokenBounded(ms = BOOTSTRAP_WAIT_MS): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const limit = new Promise<void>((resolve) => {
    timeout = setTimeout(resolve, ms)
  })
  return Promise.race([ensureMediaToken(), limit]).finally(() => clearTimeout(timeout))
}

export function clearMediaToken(): void {
  if (timer) clearTimeout(timer)
  timer = null
  generation++
  inflight = null
  retryDelay = RETRY_DELAY_MS
  useMediaTokenStore.setState({ token: null, expiresAt: null })
}

/**
 * Re-check the token when the tab comes back (visible again / window focus): timers are
 * throttled or frozen in background tabs, so the scheduled refresh may not have run.
 * `ensureMediaToken` is a no-op while the token is fresh or nobody is signed in.
 * Returns the cleanup.
 */
export function watchMediaTokenResume(): () => void {
  if (typeof window === 'undefined') return () => {}
  const onVisible = () => {
    if (document.visibilityState === 'visible') void ensureMediaToken()
  }
  const onFocus = () => void ensureMediaToken()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onFocus)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onFocus)
  }
}

/** Current token for URL building, or null (not fetched yet / signed out). */
export function getMediaToken(): string | null {
  return useMediaTokenStore.getState().token
}

// Every sign-out path (performLogout, forceLogout, SessionInitializer) ends in clearAuth().
useAuthStore.subscribe((s, prev) => {
  if (prev.accessToken && !s.accessToken) clearMediaToken()
})
