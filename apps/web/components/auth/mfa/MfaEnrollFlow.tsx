'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { authService } from '@/lib/api/auth'
import {
  isMfaRestartCode,
  markMfaCodesPending,
  mfaErrorMessage,
  type MfaRestartCode,
  type PendingMfa,
} from '@/lib/auth/mfa'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MfaEnrollCodesStep } from './MfaEnrollCodesStep'
import { MfaSetupKey } from './MfaSetupKey'
import { MfaAlert, MfaCardHeader, MfaCodeInput, MfaStep, completeCode, emptyCode } from './mfa-parts'

interface Props {
  challenge: PendingMfa
  /** Signed in and the backup codes acknowledged — go to this landing path. */
  onDone: (path: string) => void
  /** The challenge is unusable (or the user gave up) — back to /login. */
  onRestart: (code?: MfaRestartCode) => void
}

/**
 * `/mfa` enroll mode (an Owner/Admin-like account signing in before 2FA is set
 * up — mandatory for those roles; Members turn it on in Settings instead):
 * 1. install an authenticator app and scan the QR (or type the key),
 * 2. confirm one 6-digit code — 2FA is on, the backup codes are issued, but
 *    the server returns no tokens yet,
 * 3. the 10 backup codes: "I saved them" + Continue → `enroll/complete`, which
 *    is the only call that signs in (`MfaEnrollCodesStep`).
 *
 * The stage is parked with the challenge, so a reload after step 2 lands on
 * step 3 again (same codes, re-fetched) instead of inside the app.
 */
export function MfaEnrollFlow({ challenge, onDone, onRestart }: Props) {
  // Codes from the confirm answer; after a reload the codes step fetches them.
  const [issued, setIssued] = useState<{ codes?: string[] } | null>(null)

  if (issued || challenge.stage === 'codes_pending') {
    return (
      <MfaEnrollCodesStep challenge={challenge} issuedCodes={issued?.codes} onDone={onDone} onRestart={onRestart} />
    )
  }
  return <MfaEnrollSetup challenge={challenge} onConfirmed={setIssued} onRestart={onRestart} />
}

/** Steps 1–2: scan the QR (or type the key) and confirm one code. */
function MfaEnrollSetup({
  challenge,
  onConfirmed,
  onRestart,
}: {
  challenge: PendingMfa
  onConfirmed: (issued: { codes?: string[] }) => void
  onRestart: (code?: MfaRestartCode) => void
}) {
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')

  // Idempotent server-side (same pending secret per token), so a query is fine.
  const setup = useQuery({
    queryKey: ['mfa-enroll-start', challenge.mfaToken],
    queryFn: () => authService.mfaEnrollStart(challenge.mfaToken),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const setupError = setup.error ? mfaErrorMessage(setup.error) : null
  const setupRestart = setupError && isMfaRestartCode(setupError.code) ? setupError.code : null
  useEffect(() => {
    if (setupRestart) onRestart(setupRestart)
  }, [setupRestart, onRestart])

  const [digits, setDigits] = useState<string[]>(emptyCode)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)

  const confirm = async (code: string) => {
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setError(null)
    try {
      const res = await authService.mfaEnrollConfirm(challenge.mfaToken, code)
      // No session here — only `enroll/complete` signs in, after the codes are saved.
      markMfaCodesPending()
      const codes = Array.isArray(res.backupCodes) && res.backupCodes.length > 0 ? res.backupCodes : undefined
      onConfirmed({ codes })
    } catch (err) {
      const msg = mfaErrorMessage(err)
      if (isMfaRestartCode(msg.code)) {
        onRestart(msg.code)
        return
      }
      setError(t(msg.key, msg.values))
      setDigits(emptyCode())
    } finally {
      setSubmitting(false)
      inFlight.current = false
    }
  }

  const onDigits = (next: string[]) => {
    setDigits(next)
    const code = completeCode(next)
    if (code) void confirm(code)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const code = completeCode(digits)
    if (!code) {
      setError(t('mfa.codeIncomplete'))
      return
    }
    void confirm(code)
  }

  const setupData = setup.data
  const ready = !!setupData

  return (
    <Card className="w-full max-w-md shadow-none border-border">
      <MfaCardHeader title={t('mfa.enrollTitle')} description={t('mfa.enrollSubtitle')} email={challenge.user.email} />
      <CardContent className="space-y-6">
        <MfaStep n={1} title={t('mfa.enrollStep1Title')} body={t('mfa.enrollStep1Body')}>
          {setup.isPending && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('mfa.enrollLoading')}
            </div>
          )}
          {setupError && !setupRestart && (
            <div className="space-y-2">
              <MfaAlert>{t(setupError.key, setupError.values)}</MfaAlert>
              <Button type="button" variant="outline" size="sm" onClick={() => void setup.refetch()}>
                {tCommon('retry')}
              </Button>
            </div>
          )}
          {setupData && <MfaSetupKey setup={setupData} />}
        </MfaStep>

        <MfaStep n={2} title={t('mfa.enrollStep2Title')} body={t('mfa.enrollStep2Body')}>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <MfaAlert>{error}</MfaAlert>}
            <MfaCodeInput value={digits} onChange={onDigits} disabled={!ready || submitting} />
            <Button
              type="submit"
              className="w-full h-11 text-base font-bold tracking-wide"
              disabled={!ready || submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin mr-2" aria-hidden />}
              {submitting ? t('mfa.verifying') : t('mfa.confirmButton')}
            </Button>
          </form>
        </MfaStep>

        <div className="text-center text-sm">
          <button
            type="button"
            onClick={() => onRestart()}
            className="text-muted-foreground hover:text-foreground"
          >
            {t('mfa.backToLogin')}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
