import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ ok: true })

  for (const name of ['accessToken', 'refreshToken', 'sid']) {
    res.cookies.set(name, '', { maxAge: 0, path: '/' })
  }

  return res
}
