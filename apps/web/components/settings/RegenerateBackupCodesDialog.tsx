'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { authService } from '@/lib/api/auth'
import { mfaAccountErrorMessage } from '@/lib/auth/mfa'
import { Button } from '@/components/ui/button'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { BackupCodesPanel } from '@/components/auth/mfa/BackupCodesPanel'
import { MfaAlert, MfaCodeInput, completeCode, emptyCode } from '@/components/auth/mfa/mfa-parts'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountEmail: string
}

/**
 * Settings → Security "Regenerate backup codes": asks the current
 * authenticator code, then shows the 10 new codes once (the old ones stop
 * working). While the new codes are on screen the dialog can only be left
 * through "I saved my backup codes" + Done.
 */
export function RegenerateBackupCodesDialog({ open, onOpenChange, accountEmail }: Props) {
  const t = useTranslations('settings.security')
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const [digits, setDigits] = useState<string[]>(emptyCode)
  const [error, setError] = useState<string | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)

  const regenerate = useMutation({
    mutationFn: (code: string) => authService.regenerateBackupCodes(code),
    onSuccess: (res) => setCodes(res.backupCodes),
    onError: (err) => {
      const msg = mfaAccountErrorMessage(err)
      setError(tAuth(msg.key, msg.values))
      setDigits(emptyCode())
    },
  })

  const close = () => {
    setDigits(emptyCode())
    setError(null)
    setCodes(null)
    regenerate.reset()
    onOpenChange(false)
  }

  const submit = (code: string) => {
    if (regenerate.isPending) return
    setError(null)
    regenerate.mutate(code)
  }

  const onDigits = (next: string[]) => {
    setDigits(next)
    const code = completeCode(next)
    if (code) submit(code)
  }

  const onSubmitClick = () => {
    const code = completeCode(digits)
    if (!code) {
      setError(tAuth('mfa.codeIncomplete'))
      return
    }
    submit(code)
  }

  return (
    <ResponsiveModal
      open={open}
      // New codes on screen: only "Done" (after ticking the checkbox) closes.
      onOpenChange={(o) => (o ? onOpenChange(true) : !codes && close())}
      showCloseButton={!codes}
      title={codes ? tAuth('mfa.backupTitle') : t('regenerateTitle')}
      description={codes ? tAuth('mfa.backupSubtitle') : t('regenerateBody')}
      footer={
        codes ? undefined : (
          <>
            <Button variant="outline" onClick={close}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={onSubmitClick} disabled={regenerate.isPending}>
              {regenerate.isPending && <Loader2 className="size-4 animate-spin mr-2" aria-hidden />}
              {t('regenerateSubmit')}
            </Button>
          </>
        )
      }
    >
      {codes ? (
        <BackupCodesPanel
          codes={codes}
          accountEmail={accountEmail}
          continueLabel={t('regenerateDone')}
          onContinue={close}
        />
      ) : (
        <div className="space-y-3 py-2">
          {error && <MfaAlert>{error}</MfaAlert>}
          <MfaCodeInput value={digits} onChange={onDigits} disabled={regenerate.isPending} />
        </div>
      )}
    </ResponsiveModal>
  )
}
