import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { AuthUser } from '@/lib/store/auth.store'

// Cookie lifetimes — keep in sync with /api/auth/set-cookie and /api/auth/refresh.
const ACCESS_TOKEN_MAX_AGE = 900 // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

const baseCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

// A refresh/user fetch failed for a *real* auth reason only when auth-service
// itself rejected it (401/403). Anything else — network error, timeout, cold
// start, 5xx, 429 — is transient and must NOT destroy the session cookies.
const isUpstreamAuthRejection = (err: unknown): boolean =>
  axios.isAxiosError(err) &&
  (err.response?.status === 401 || err.response?.status === 403)

const upstreamCode = (err: unknown): string | undefined =>
  axios.isAxiosError(err)
    ? (err.response?.data as { code?: string } | undefined)?.code
    : undefined

export async function GET(request: NextRequest) {
  let accessToken = request.cookies.get('accessToken')?.value
  const sid = request.cookies.get('sid')?.value
  const refreshToken = request.cookies.get('refreshToken')?.value

  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL

  // Backend uses ROTATING refresh tokens with reuse detection: every successful
  // refresh invalidates the presented refresh token and returns a new one. If we
  // refresh here but forget to persist the rotated refreshToken, the cookie keeps
  // a now-superseded token; the next refresh replays it, the backend flags it as
  // reuse, revokes the session, and the user is kicked to /login. So whenever we
  // refresh we MUST write the rotated refreshToken back to the cookie.
  let rotatedRefreshToken: string | null = null

  const fetchUser = async (token: string): Promise<AuthUser & { avatarUrl?: string }> => {
    const { data } = await axios.get<AuthUser & { _id?: string; avatarUrl?: string }>(`${authUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // Mongoose may serialize _id but omit the id virtual — normalise here
    return { ...data, id: data.id || data._id || '' }
  }

  const refresh = async (): Promise<string> => {
    const { data } = await axios.post<{ accessToken: string; refreshToken?: string }>(
      `${authUrl}/auth/refresh`,
      { sid, refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    )
    if (data.refreshToken) rotatedRefreshToken = data.refreshToken
    return data.accessToken
  }

  const withSessionCookies = (res: NextResponse, token: string) => {
    res.cookies.set('accessToken', token, { ...baseCookieOpts, maxAge: ACCESS_TOKEN_MAX_AGE })
    // Persist the rotated refresh token so the cookie never lags behind the
    // backend's current token (otherwise the next refresh triggers reuse detection).
    if (rotatedRefreshToken) {
      res.cookies.set('refreshToken', rotatedRefreshToken, { ...baseCookieOpts, maxAge: REFRESH_TOKEN_MAX_AGE })
      // Slide sid alongside the refresh token — the backend session TTL slides
      // on rotation, so an active user must never lose the sid cookie first.
      if (sid) {
        res.cookies.set('sid', sid, { ...baseCookieOpts, maxAge: REFRESH_TOKEN_MAX_AGE })
      }
    }
    return res
  }

  // Session is genuinely dead (auth-service rejected it) → destroy the cookies.
  const clearSession = () => {
    const res = NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    res.cookies.delete('accessToken')
    res.cookies.delete('refreshToken')
    res.cookies.delete('sid')
    return res
  }

  // Auth-service unreachable / erroring → tell the client to retry WITHOUT
  // destroying the cookies. Wiping them here turned every cold start or network
  // blip on page load into a forced re-login. If a refresh already rotated the
  // token before the failure (e.g. /api/users/me timed out after a successful
  // /auth/refresh), the rotated credentials MUST still be persisted — otherwise
  // the cookie keeps the superseded token and the next attempt replays it into
  // reuse detection.
  const transient = () => {
    const res = NextResponse.json({ error: 'transient' }, { status: 503 })
    if (rotatedRefreshToken) {
      if (accessToken) {
        res.cookies.set('accessToken', accessToken, { ...baseCookieOpts, maxAge: ACCESS_TOKEN_MAX_AGE })
      }
      res.cookies.set('refreshToken', rotatedRefreshToken, { ...baseCookieOpts, maxAge: REFRESH_TOKEN_MAX_AGE })
      if (sid) {
        res.cookies.set('sid', sid, { ...baseCookieOpts, maxAge: REFRESH_TOKEN_MAX_AGE })
      }
    }
    return res
  }

  // Benign multi-tab race: another tab rotated the refresh token first and its
  // Set-Cookie already updated the shared jar. Keep the cookies; the client
  // retries this request and succeeds with the sibling tab's rotated token.
  const raceLost = () =>
    NextResponse.json({ error: 'race_lost', code: 'REFRESH_TOKEN_ROTATED' }, { status: 401 })

  const handleRefreshError = (err: unknown) => {
    if (!isUpstreamAuthRejection(err)) return transient()
    if (upstreamCode(err) === 'REFRESH_TOKEN_ROTATED') return raceLost()
    return clearSession()
  }

  if (!accessToken) {
    if (!sid || !refreshToken) {
      return clearSession()
    }
    try {
      accessToken = await refresh()
    } catch (err) {
      return handleRefreshError(err)
    }
  }

  try {
    const user = await fetchUser(accessToken)
    return withSessionCookies(NextResponse.json({ user, accessToken }), accessToken)
  } catch (error) {
    if (!isUpstreamAuthRejection(error)) {
      // /api/users/me failed for a non-auth reason — keep the session.
      return transient()
    }
    // Only refresh-on-401 if we haven't already rotated above. Replaying the
    // original (now-superseded) refresh token would trip reuse detection.
    if (sid && refreshToken && !rotatedRefreshToken) {
      try {
        const newAccessToken = await refresh()
        // Keep the outer variable current so transient() persists the FRESH
        // access token if the fetchUser below fails non-fatally.
        accessToken = newAccessToken
        const user = await fetchUser(newAccessToken)
        return withSessionCookies(NextResponse.json({ user, accessToken: newAccessToken }), newAccessToken)
      } catch (err) {
        // The nested fetchUser can also fail transiently — classify again.
        return handleRefreshError(err)
      }
    }
    return clearSession()
  }
}
