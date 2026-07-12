import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

// Cookie lifetimes — keep in sync with /api/auth/set-cookie and /api/auth/session.
const ACCESS_TOKEN_MAX_AGE = 900 // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

const baseCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export async function POST(request: NextRequest) {
  const sid = request.cookies.get('sid')?.value
  const refreshToken = request.cookies.get('refreshToken')?.value

  if (!sid || !refreshToken) {
    return NextResponse.json({ error: 'no_refresh' }, { status: 401 })
  }

  try {
    const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${process.env.NEXT_PUBLIC_AUTH_URL}/auth/refresh`,
      { sid, refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    )

    const res = NextResponse.json({ accessToken: data.accessToken })
    res.cookies.set('accessToken', data.accessToken, {
      ...baseCookieOpts,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    })

    // Rotating refresh tokens: persist the rotated token or the next refresh
    // replays a superseded one and trips reuse detection (forced logout).
    if (data.refreshToken) {
      res.cookies.set('refreshToken', data.refreshToken, {
        ...baseCookieOpts,
        maxAge: REFRESH_TOKEN_MAX_AGE,
      })
    }

    // Slide the sid cookie alongside the refresh token. The backend session
    // TTL slides on every rotation; without renewing sid here the cookie
    // expires 30 days after LOGIN even for a daily-active user, leaving a
    // refreshToken with no sid → guaranteed logout.
    res.cookies.set('sid', sid, {
      ...baseCookieOpts,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    })

    return res
  } catch (err) {
    // Only translate a genuine auth-service rejection (401/403) into a 401 —
    // that is the ONLY signal clients may treat as "session dead → logout".
    // Forward the upstream error code so clients can retry the benign
    // REFRESH_TOKEN_ROTATED race (another tab rotated first).
    if (
      axios.isAxiosError(err) &&
      (err.response?.status === 401 || err.response?.status === 403)
    ) {
      const code = (err.response.data as { code?: string } | undefined)?.code
      return NextResponse.json({ error: 'refresh_rejected', code }, { status: 401 })
    }
    // Transient upstream failure (network, timeout, cold start, 5xx, 429).
    // Return 503 so isAuthFailure() is false and NO client logs the user out.
    return NextResponse.json({ error: 'transient' }, { status: 503 })
  }
}
