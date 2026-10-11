'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { clearPendingMfa, pendingMfaExpired, readPendingMfa, type MfaRestartCode } from '@/lib/auth/mfa'
import { loginPath } from '@/lib/auth/force-logout'
import { maybeRequestNotificationPermission } from '@/lib/notifications'
import { MfaEnrollFlow } from '@/components/auth/mfa/MfaEnrollFlow'
import { MfaVerifyForm } from '@/components/auth/mfa/MfaVerifyForm'

const noopSubscribe = () => () => {}
const noChallengeOnServer = () => undefined

/**
 * Second step of a password / Google sign-in when 2FA applies (contract 15:
 * Owner/Admin-like roles always, Members who turned it on).
 * Reached only from the login, Google-callback or invite screens with a parked
 * challenge (`lib/auth/mfa.ts`); without one the visitor goes back to /login
 * (with the "expired" notice when the parked one outlived the server TTL).
 * Guest-only like /login (middleware): no session exists until this step ends —
 * an enrollment only signs in after the backup codes were acknowledged.
 */
export default function MfaPage() {
  const router = useRouter()
  const tCommon = useTranslations('common')
  // `undefined` while server-rendering / hydrating, then the challenge or null.
  const challenge = useSyncExternalStore(noopSubscribe, readPendingMfa, noChallengeOnServer)
  // Set when this screen hands off (signed in, or back to /login) so clearing
  // the challenge does not trigger the "no challenge → /login" redirect too.
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (challenge === null && !leaving) {
      router.replace(pendingMfaExpired() ? loginPath('MFA_TOKEN_INVALID') : '/login')
    }
  }, [challenge, leaving, router])

  const leave = useCallback(
    (path: string) => {
      setLeaving(true)
      clearPendingMfa()
      router.replace(path)
    },
    [router],
  )

  // Same landing as a password login: set-password gate first when flagged.
  const onDone = useCallback(
    (path: string) => {
      void maybeRequestNotificationPermission()
      leave(path)
    },
    [leave],
  )

  // Expired / burned challenge → /login explains why; "Back to sign in" → plain /login.
  const onRestart = useCallback((code?: MfaRestartCode) => leave(loginPath(code)), [leave])

  if (!challenge || leaving) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <span className="sr-only">{tCommon('loading')}</span>
      </div>
    )
  }

  return challenge.enrollmentRequired ? (
    <MfaEnrollFlow challenge={challenge} onDone={onDone} onRestart={onRestart} />
  ) : (
    <MfaVerifyForm challenge={challenge} onDone={onDone} onRestart={onRestart} />
  )
}
