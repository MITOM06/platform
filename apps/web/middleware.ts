import { NextRequest, NextResponse } from 'next/server'

// /oauth-callback must be public: the user lands here from Google with no
// session cookie yet — the page itself exchanges the code, sets cookies, then
// redirects to '/'. Without this, middleware bounces it straight to /login.
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/verify-otp',
  '/oauth-callback',
  '/forgot-password',
  '/privacy',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const hasSession = request.cookies.has('accessToken') || request.cookies.has('refreshToken')

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
