'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { authService } from '@/lib/api/auth'
import { parseAuthError, authCodeToI18nKey } from '@/lib/auth/auth-error'
import { isLoginNotice, loginPath } from '@/lib/auth/force-logout'
import { MFA_PATH, isMfaChallenge, savePendingMfa } from '@/lib/auth/mfa'
import { establishSession } from '@/lib/auth/sign-in'

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations('auth.oauth')
  const tAuth = useTranslations('auth')

  useEffect(() => {
    // OAuth error-redirect contract (plan §1.5): the auth-service sends the
    // browser back here with `?error=<AuthCode>` when Google/SSO sign-in or an
    // invitation accept fails (e.g. ACCOUNT_NOT_PROVISIONED, ACCOUNT_BLOCKED).
    // The reason is handed to /login as a persistent banner rather than a
    // toast: on a slow load the toast is gone before /login has rendered.
    const error = searchParams.get('error')
    if (error) {
      router.replace(loginPath(isLoginNotice(error) ? error : 'GENERIC_ERROR'))
      return
    }

    const code = searchParams.get('code')
    if (!code) {
      router.replace('/login')
      return
    }

    authService
      .exchangeCode(code)
      .then(async ({ data }) => {
        // Owner / Admin signing in with Google: finish with the authenticator
        // code (or first-time 2FA setup) on /mfa before any session exists.
        if (isMfaChallenge(data)) {
          savePendingMfa(data)
          router.replace(MFA_PATH)
          return
        }
        // A member who just joined with Google must create a PON password first.
        router.replace(await establishSession(data))
      })
      .catch((err: unknown) => {
        // Specific reason when the server gave one (e.g. ACCOUNT_BLOCKED),
        // otherwise the generic "authentication failed" copy.
        const { code: errCode, params } = parseAuthError(err)
        if (isLoginNotice(errCode) && errCode !== 'GENERIC_ERROR') {
          router.replace(loginPath(errCode))
          return
        }
        toast.error(errCode === 'GENERIC_ERROR' ? t('failed') : tAuth(authCodeToI18nKey(errCode), params))
        router.replace('/login')
      })
  }, [searchParams, router, t, tAuth])

  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="text-center space-y-2">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">{t('verifying')}</p>
      </div>
    </div>
  )
}
