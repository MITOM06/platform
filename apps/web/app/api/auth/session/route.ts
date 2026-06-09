import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export async function GET(request: NextRequest) {
  let accessToken = request.cookies.get('accessToken')?.value
  const sid = request.cookies.get('sid')?.value
  const refreshToken = request.cookies.get('refreshToken')?.value

  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL

  const fetchUser = async (token: string) => {
    const { data } = await axios.get(`${authUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return data
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
      const refreshResponse = await axios.post<{ accessToken: string }>(
        `${authUrl}/auth/refresh`,
        { sid, refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      )
      accessToken = refreshResponse.data.accessToken
    } catch {
      return clearSession()
    }
  }

  try {
    const user = await fetchUser(accessToken)
    const res = NextResponse.json({ user, accessToken })
    res.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 900,
      path: '/',
    })
    return res
  } catch (error: any) {
    if (error.response?.status === 401 && sid && refreshToken) {
      try {
        const refreshResponse = await axios.post<{ accessToken: string }>(
          `${authUrl}/auth/refresh`,
          { sid, refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        )
        const newAccessToken = refreshResponse.data.accessToken
        const user = await fetchUser(newAccessToken)
        const res = NextResponse.json({ user, accessToken: newAccessToken })
        res.cookies.set('accessToken', newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 900,
          path: '/',
        })
        return res
      } catch {
        return clearSession()
      }
    }
    return clearSession()
  }
}
