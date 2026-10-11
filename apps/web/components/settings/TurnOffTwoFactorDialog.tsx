'use client'

import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { authService, type MfaProof } from '@/lib/api/auth'
import { formatBackupCode, isCompleteBackupCode, mfaSelfErrorMessage } from '@/lib/auth/mfa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { MfaAlert, MfaCodeInput, completeCode, emptyCode } from '@/components/auth/mfa/mfa-parts'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 2FA is off now. */
  onTurnedOff: () => void
  /** The shown 2FA state is out of date (role / SSO / changed elsewhere) — refetch `/me`. */
  onStale: () => void
}

/**
 * Settings → Security "Turn off 2FA" (contract 15, Members only): proves the
 * user still holds the factor with a current authenticator code or one unused
 * backup code. Errors stay in the dialog, localized; an Owner/Admin-like role
 * gets `MFA_REQUIRED_BY_ROLE` and the section refreshes to the required state.
 */
export function TurnOffTwoFactorDialog({ open, onOpenChange, onTurnedOff, onStale }: Props) {
  const t = useTranslations('settings.security')
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const [mode, setMode] = useState<'totp' | 'backup'>('totp')
  const [digits, setDigits] = useState<string[]>(emptyCode)
  const [backupCode, setBackupCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setMode('totp')
    setDigits(emptyCode())
    setBackupCode('')
    setError(null)
  }

  const disable = useMutation({
    mutationFn: (proof: MfaProof) => authService.selfMfaDisable(proof),
    onSuccess: () => {
      reset()
      onOpenChange(false)
      onTurnedOff()
    },
    onError: (err) => {
      const msg = mfaSelfErrorMessage(err)
      setError(tAuth(msg.key, msg.values))
      setDigits(emptyCode())
      if (msg.stale) onStale()
    },
  })

  const close = () => {
    reset()
    disable.reset()
    onOpenChange(false)
  }

  const onSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    if (disable.isPending) return
    const code = completeCode(digits)
    if (mode === 'totp' && !code) {
      setError(tAuth('mfa.codeIncomplete'))
      return
    }
    if (mode === 'backup' && !isCompleteBackupCode(backupCode)) {
      setError(tAuth('mfa.backupCodeFormat'))
      return
    }
    setError(null)
    disable.mutate(mode === 'totp' && code ? { code } : { backupCode })
  }

  const switchMode = () => {
    setMode((m) => (m === 'totp' ? 'backup' : 'totp'))
    setDigits(emptyCode())
    setBackupCode('')
    setError(null)
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={t('turnOffTitle')}
      description={t('turnOffBody')}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            {tCommon('cancel')}
          </Button>
          <Button variant="destructive" onClick={() => onSubmit()} disabled={disable.isPending}>
            {disable.isPending && <Loader2 className="size-4 animate-spin mr-2" aria-hidden />}
            {t('turnOffSubmit')}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3 py-2">
        {error && <MfaAlert>{error}</MfaAlert>}
        {/* Hidden submit so Enter in the code boxes submits too. */}
        <button type="submit" hidden tabIndex={-1} />
        {mode === 'totp' ? (
          <MfaCodeInput value={digits} onChange={setDigits} disabled={disable.isPending} />
        ) : (
          <div className="space-y-1">
            <Label htmlFor="turn-off-backup-code">{tAuth('mfa.backupCodeLabel')}</Label>
            <Input
              id="turn-off-backup-code"
              value={backupCode}
              onChange={(e) => setBackupCode(formatBackupCode(e.target.value))}
              placeholder={tAuth('mfa.backupCodePlaceholder')}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={disable.isPending}
              className="h-11 text-center font-mono text-base tracking-widest"
            />
          </div>
        )}
        <div className="text-center text-sm">
          <button
            type="button"
            onClick={switchMode}
            disabled={disable.isPending}
            className="font-medium text-primary hover:underline underline-offset-4 disabled:opacity-50"
          >
            {mode === 'totp' ? tAuth('mfa.useBackupCode') : tAuth('mfa.useAuthenticator')}
          </button>
        </div>
      </form>
    </ResponsiveModal>
  )
}
