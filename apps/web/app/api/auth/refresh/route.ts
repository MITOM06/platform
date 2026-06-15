import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

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
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 900, // 15 minutes
      path: '/',
    })
    
    // Zalo-style robust refresh: ensure rotated refreshToken is updated in cookie
    if (data.refreshToken) {
      res.cookies.set('refreshToken', data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }
    
    return res
  } catch {
    return NextResponse.json({ error: 'refresh_failed' }, { status: 401 })
  }
}
