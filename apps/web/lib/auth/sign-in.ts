import type { LoginResponse } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth.store'
import { postSignInPath } from '@/lib/auth/set-password-gate'

/**
 * The one way a sign-in becomes a web session — password login, Google
 * exchange and the 2FA step all end here, so they behave identically:
 * httpOnly cookies via the Next.js route, the access token in memory, then the
 * landing path (`/set-password` while the account must create its password,
 * `/` otherwise).
 */
export async function establishSession(result: LoginResponse): Promise<string> {
  const { accessToken, refreshToken, sid, user } = result
  await fetch('/api/auth/set-cookie', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, refreshToken, sid }),
  })
  useAuthStore.getState().setAuth(user, accessToken)
  return postSignInPath(user)
}
