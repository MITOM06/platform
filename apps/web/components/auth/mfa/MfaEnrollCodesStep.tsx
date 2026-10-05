'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { authService, type LoginResponse } from '@/lib/api/auth'
import { isMfaRestartCode, mfaErrorMessage, type MfaRestartCode, type PendingMfa } from '@/lib/auth/mfa'
import { establishSession } from '@/lib/auth/sign-in'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BackupCodesPanel } from './BackupCodesPanel'
import { MfaAlert, MfaCardHeader } from './mfa-parts'

interface Props {
  challenge: PendingMfa
  /** Codes from the confirm answer. Absent after a reload → re-fetched with `enroll/codes`. */
  issuedCodes?: string[]
  /** Signed in — go to this landing path. */
  onDone: (path: string) => void
  /** The challenge is unusable — back to /login with the reason. */
  onRestart: (code?: MfaRestartCode) => void
}

/**
 * `/mfa` enroll mode, last step: 2FA is already on (`enroll/confirm`) but there
 * is no session yet. The user must tick "I saved my backup codes"; Continue
 * then calls `enroll/complete`, which issues the session — so a reload or a
 * closed tab can never reach the app without passing through this screen.
 */
export function MfaEnrollCodesStep({ challenge, issuedCodes, onDone, onRestart }: Props) {
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')

  // Only after a reload: the server keeps the same codes until `complete`.
  // gcTime 0 — the plaintext codes do not outlive this screen in the cache.
  const stored = useQuery({
    queryKey: ['mfa-enroll-codes', challenge.mfaToken],
    queryFn: () => authService.mfaEnrollCodes(challenge.mfaToken),
    enabled: !issuedCodes,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const codes = issuedCodes ?? stored.data?.backupCodes
  const loadError = !issuedCodes && stored.error ? mfaErrorMessage(stored.error) : null
  const loadRestart = loadError && isMfaRestartCode(loadError.code) ? loadError.code : null
  useEffect(() => {
    if (loadRestart) onRestart(loadRestart)
  }, [loadRestart, onRestart])

  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const inFlight = useRef(false)
  // `complete` is single use: keep its answer so a failed cookie write retries without it.
  const session = useRef<LoginResponse | null>(null)

  const finish = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setFinishing(true)
    setError(null)
    try {
      if (!session.current) session.current = await authService.mfaEnrollComplete(challenge.mfaToken)
      onDone(await establishSession(session.current))
    } catch (err) {
      const msg = mfaErrorMessage(err)
      if (isMfaRestartCode(msg.code)) {
        onRestart(msg.code)
        return
      }
      setError(t(msg.key, msg.values))
    } finally {
      setFinishing(false)
      inFlight.current = false
    }
  }

  return (
    <Card className="w-full max-w-md shadow-none border-border">
      <MfaCardHeader title={t('mfa.backupTitle')} description={t('mfa.backupSubtitle')} email={challenge.user.email} />
      <CardContent className="space-y-4">
        {error && <MfaAlert>{error}</MfaAlert>}
        {codes ? (
          <BackupCodesPanel
            codes={codes}
            accountEmail={challenge.user.email}
            continueLabel={t('mfa.continue')}
            onContinue={() => void finish()}
            busy={finishing}
          />
        ) : loadError && !loadRestart ? (
          <div className="space-y-2">
            <MfaAlert>{t(loadError.key, loadError.values)}</MfaAlert>
            <Button type="button" variant="outline" size="sm" onClick={() => void stored.refetch()}>
              {tCommon('retry')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('mfa.codesLoading')}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
