import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/verify-otp']

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
