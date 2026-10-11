'use client'

import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { authService } from '@/lib/api/auth'
import type { SelfMfaEnrollStartResponse } from '@/lib/api/types'
import { mfaSelfErrorMessage } from '@/lib/auth/mfa'
import { Button } from '@/components/ui/button'
import { BackupCodesPanel } from '@/components/auth/mfa/BackupCodesPanel'
import { MfaSetupKey } from '@/components/auth/mfa/MfaSetupKey'
import { MfaAlert, MfaCodeInput, MfaStep, completeCode, emptyCode } from '@/components/auth/mfa/mfa-parts'

interface Props {
  /** The pending secret from `enroll/start`. */
  setup: SelfMfaEnrollStartResponse
  /** Account the codes belong to — written into the downloaded file. */
  accountEmail: string
  /** `enroll/confirm` succeeded: 2FA is on (the codes are still on screen). */
  onEnabled: () => void
  /** The backup codes were acknowledged — the flow is finished. */
  onDone: () => void
  /** Left before confirming — nothing changed. */
  onCancel: () => void
  /** The flow can't continue (setup expired, state changed elsewhere, SSO required). */
  onAbort: (message: string, stale: boolean) => void
}

/**
 * Settings → Security "Turn on 2FA" (contract 15, Members): the same steps as
 * the sign-in enrollment, in the page and without any session change —
 * 1. scan the QR (or type the key), 2. confirm one code, 3. the 10 backup codes
 * once, left only through "I saved my backup codes" + Done.
 */
export function TwoFactorEnrollPanel({ setup, accountEmail, onEnabled, onDone, onCancel, onAbort }: Props) {
  const t = useTranslations('settings.security')
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const [digits, setDigits] = useState<string[]>(emptyCode)
  const [error, setError] = useState<string | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)

  const confirm = useMutation({
    mutationFn: (code: string) => authService.selfMfaEnrollConfirm(code),
    onSuccess: (res) => {
      onEnabled()
      const issued = Array.isArray(res.backupCodes) ? res.backupCodes : []
      if (issued.length > 0) setCodes(issued)
      else onDone()
    },
    onError: (err) => {
      const msg = mfaSelfErrorMessage(err)
      // No pending secret any more (its 10 minutes passed): start again for a new QR.
      if (msg.code === 'MFA_NOT_ENROLLED') {
        onAbort(tAuth('mfa.setupExpired'), false)
        return
      }
      // Already on elsewhere / SSO now required: the section re-reads `/me`.
      if (msg.stale) {
        onAbort(tAuth(msg.key, msg.values), true)
        return
      }
      // Wrong code, or too many (a temporary lockout — the same QR stays valid).
      setError(tAuth(msg.key, msg.values))
      setDigits(emptyCode())
    },
  })

  const submit = (code: string) => {
    if (confirm.isPending) return
    setError(null)
    confirm.mutate(code)
  }

  const onDigits = (next: string[]) => {
    setDigits(next)
    const code = completeCode(next)
    if (code) submit(code)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const code = completeCode(digits)
    if (!code) {
      setError(tAuth('mfa.codeIncomplete'))
      return
    }
    submit(code)
  }

  if (codes) {
    return (
      <div className="space-y-4" data-testid="two-factor-codes">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{tAuth('mfa.backupTitle')}</h3>
          <p className="text-sm text-muted-foreground">{tAuth('mfa.backupSubtitle')}</p>
        </div>
        <BackupCodesPanel codes={codes} accountEmail={accountEmail} continueLabel={t('turnOnDone')} onContinue={onDone} />
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="two-factor-enroll">
      <h3 className="text-sm font-semibold">{tAuth('mfa.enrollTitle')}</h3>
      <MfaStep n={1} title={tAuth('mfa.enrollStep1Title')} body={tAuth('mfa.enrollStep1Body')}>
        <MfaSetupKey setup={setup} />
      </MfaStep>
      <MfaStep n={2} title={tAuth('mfa.enrollStep2Title')} body={tAuth('mfa.enrollStep2Body')}>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <MfaAlert>{error}</MfaAlert>}
          <MfaCodeInput value={digits} onChange={onDigits} disabled={confirm.isPending} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={confirm.isPending}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={confirm.isPending}>
              {confirm.isPending && <Loader2 className="size-4 animate-spin mr-2" aria-hidden />}
              {confirm.isPending ? tAuth('mfa.verifying') : tAuth('mfa.confirmButton')}
            </Button>
          </div>
        </form>
      </MfaStep>
    </div>
  )
}
