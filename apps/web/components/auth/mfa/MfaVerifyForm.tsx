'use client'

import { useRef, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { authService, type MfaProof } from '@/lib/api/auth'
import {
  formatBackupCode,
  isCompleteBackupCode,
  isMfaRestartCode,
  mfaErrorMessage,
  type MfaRestartCode,
  type PendingMfa,
} from '@/lib/auth/mfa'
import { establishSession } from '@/lib/auth/sign-in'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { MfaAlert, MfaCardHeader, MfaCodeInput, completeCode, emptyCode } from './mfa-parts'

interface Props {
  challenge: PendingMfa
  /** Signed in — go to this landing path. */
  onDone: (path: string) => void
  /** The challenge is unusable (or the user gave up) — back to /login. */
  onRestart: (code?: MfaRestartCode) => void
}

/**
 * `/mfa` verify mode (already enrolled): the 6-digit authenticator code,
 * submitted as soon as the sixth digit lands, or one single-use backup code.
 */
export function MfaVerifyForm({ challenge, onDone, onRestart }: Props) {
  const t = useTranslations('auth')
  const [mode, setMode] = useState<'totp' | 'backup'>('totp')
  const [digits, setDigits] = useState<string[]>(emptyCode)
  const [backupCode, setBackupCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Guards the auto-submit and Enter racing each other within one render.
  const inFlight = useRef(false)

  const submit = async (proof: MfaProof) => {
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setError(null)
    try {
      const res = await authService.mfaVerify(challenge.mfaToken, proof)
      const path = await establishSession(res)
      if ('backupCode' in proof && typeof res.backupCodesRemaining === 'number') {
        toast.warning(t('mfa.backupCodesRemaining', { count: res.backupCodesRemaining }))
      }
      onDone(path)
    } catch (err) {
      const msg = mfaErrorMessage(err)
      if (isMfaRestartCode(msg.code)) {
        onRestart(msg.code)
        return
      }
      setError(t(msg.key, msg.values))
      setDigits(emptyCode())
      setSubmitting(false)
      inFlight.current = false
    }
  }

  // Auto-submit once the sixth digit is in (typed or pasted).
  const onDigits = (next: string[]) => {
    setDigits(next)
    const code = completeCode(next)
    if (code) void submit({ code })
  }

  const onSubmitTotp = (e: FormEvent) => {
    e.preventDefault()
    const code = completeCode(digits)
    if (!code) {
      setError(t('mfa.codeIncomplete'))
      return
    }
    void submit({ code })
  }

  const onSubmitBackup = (e: FormEvent) => {
    e.preventDefault()
    if (!isCompleteBackupCode(backupCode)) {
      setError(t('mfa.backupCodeFormat'))
      return
    }
    void submit({ backupCode })
  }

  const switchMode = () => {
    setMode((m) => (m === 'totp' ? 'backup' : 'totp'))
    setError(null)
    setDigits(emptyCode())
    setBackupCode('')
  }

  return (
    <Card className="w-full max-w-md shadow-none border-border">
      <MfaCardHeader
        title={t('mfa.verifyTitle')}
        description={mode === 'totp' ? t('mfa.verifySubtitle') : t('mfa.backupModeSubtitle')}
        email={challenge.user.email}
      />
      <CardContent className="space-y-4">
        {error && <MfaAlert>{error}</MfaAlert>}

        {mode === 'totp' ? (
          <form onSubmit={onSubmitTotp} className="space-y-4">
            <MfaCodeInput value={digits} onChange={onDigits} disabled={submitting} />
            <SubmitButton submitting={submitting} label={t('mfa.verifyButton')} busyLabel={t('mfa.verifying')} />
          </form>
        ) : (
          <form onSubmit={onSubmitBackup} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="mfa-backup-code">{t('mfa.backupCodeLabel')}</Label>
              <Input
                id="mfa-backup-code"
                value={backupCode}
                onChange={(e) => setBackupCode(formatBackupCode(e.target.value))}
                placeholder={t('mfa.backupCodePlaceholder')}
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={submitting}
                className="h-11 text-center font-mono text-base tracking-widest"
              />
            </div>
            <SubmitButton submitting={submitting} label={t('mfa.verifyButton')} busyLabel={t('mfa.verifying')} />
          </form>
        )}

        <div className="flex flex-col items-center gap-2 pt-1 text-sm">
          <button
            type="button"
            onClick={switchMode}
            disabled={submitting}
            className="font-medium text-primary hover:underline underline-offset-4 disabled:opacity-50"
          >
            {mode === 'totp' ? t('mfa.useBackupCode') : t('mfa.useAuthenticator')}
          </button>
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

function SubmitButton({ submitting, label, busyLabel }: { submitting: boolean; label: string; busyLabel: string }) {
  return (
    <Button type="submit" className="w-full h-11 text-base font-bold tracking-wide" disabled={submitting}>
      {submitting && <Loader2 className="size-4 animate-spin mr-2" aria-hidden />}
      {submitting ? busyLabel : label}
    </Button>
  )
}
