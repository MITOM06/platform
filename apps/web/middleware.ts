import { NextRequest, NextResponse } from 'next/server'
import { isSafeReturnPath, RETURN_PATH_COOKIE, RETURN_PATH_MAX_AGE } from '@/lib/auth/return-path'
import { isGuestOnlyPath } from '@/lib/auth/guest-paths'

// Auth pages (lib/auth/guest-paths.ts) — redirect logged-in users away.
// Legal pages — accessible to everyone regardless of auth state
const ALWAYS_PUBLIC_PATHS = ['/privacy', '/terms']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthOnly = isGuestOnlyPath(pathname)
  const isAlwaysPublic = ALWAYS_PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const hasSession = request.cookies.has('accessToken') || request.cookies.has('refreshToken')

  if (isAlwaysPublic) return NextResponse.next()
  if (!hasSession && !isAuthOnly) {
    const res = NextResponse.redirect(new URL('/login', request.url))
    // Remember a meeting link so signing in lands back on it (lib/auth/return-path.ts).
    if (isSafeReturnPath(pathname)) {
      res.cookies.set(RETURN_PATH_COOKIE, pathname, {
        path: '/',
        maxAge: RETURN_PATH_MAX_AGE,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
      })
    }
    return res
  }
  if (hasSession && isAuthOnly) return NextResponse.redirect(new URL('/', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
