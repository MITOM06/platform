import { NextRequest, NextResponse } from 'next/server'

// Auth pages — redirect logged-in users away.
// /oauth-callback must be reachable without a session: the user lands here from
// Google with no cookie yet — the page exchanges the code, sets cookies, then
// redirects to '/'. It is logged-out-only, hence it belongs here.
// /invite/<token> is logged-out-only too: a signed-in user opening an invite
// link is bounced home (the invitation is for a not-yet-existing account).
const AUTH_ONLY_PATHS = ['/login', '/invite', '/verify-otp', '/oauth-callback', '/forgot-password']
// Legal pages — accessible to everyone regardless of auth state
const ALWAYS_PUBLIC_PATHS = ['/privacy', '/terms']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthOnly = AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p))
  const isAlwaysPublic = ALWAYS_PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const hasSession = request.cookies.has('accessToken') || request.cookies.has('refreshToken')

  if (isAlwaysPublic) return NextResponse.next()
  if (!hasSession && !isAuthOnly) return NextResponse.redirect(new URL('/login', request.url))
  if (hasSession && isAuthOnly) return NextResponse.redirect(new URL('/', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
