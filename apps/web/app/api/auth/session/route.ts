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
    }
    return res
  }

  const clearSession = () => {
    const res = NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    res.cookies.delete('accessToken')
    res.cookies.delete('refreshToken')
    res.cookies.delete('sid')
    return res
  }

  if (!accessToken) {
    if (!sid || !refreshToken) {
      return clearSession()
    }
    try {
      accessToken = await refresh()
    } catch {
      return clearSession()
    }
  }

  try {
    const user = await fetchUser(accessToken)
    return withSessionCookies(NextResponse.json({ user, accessToken }), accessToken)
  } catch (error) {
    const isUnauthorized = axios.isAxiosError(error) && error.response?.status === 401
    // Only refresh-on-401 if we haven't already rotated above. Replaying the
    // original (now-superseded) refresh token would trip reuse detection.
    if (isUnauthorized && sid && refreshToken && !rotatedRefreshToken) {
      try {
        const newAccessToken = await refresh()
        const user = await fetchUser(newAccessToken)
        return withSessionCookies(NextResponse.json({ user, accessToken: newAccessToken }), newAccessToken)
      } catch {
        return clearSession()
      }
    }
    return clearSession()
  }
}
