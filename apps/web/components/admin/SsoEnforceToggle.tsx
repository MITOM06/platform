'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ResponsiveModal } from '@/components/ui/responsive-modal'

interface Props {
  /** Local (unsaved) value of "Require SSO". */
  checked: boolean
  /** Value currently stored on the server — an unsaved change shows a save hint. */
  saved: boolean
  /** SSO is on and at least one allowed domain is listed (client-side precheck). */
  ready: boolean
  /** Localized error from the last save (e.g. `SSO_ENFORCE_NOT_READY`). */
  error?: string | null
  onCheckedChange: (next: boolean) => void
}

/**
 * Admin → SSO "Require SSO for these domains" switch (contract 13 C). Turning
 * it on asks for confirmation first, spelling out the consequences: password,
 * Google and password reset stop working for those domains, Owners keep
 * password + 2FA as break-glass, and non-SSO sessions are signed out. Turning
 * it off needs no confirmation (passwords were only disabled, never deleted).
 * The value is persisted with the panel's Save, like the rest of the SSO form.
 */
export function SsoEnforceToggle({ checked, saved, ready, error, onCheckedChange }: Props) {
  const t = useTranslations('admin')
  const tAuth = useTranslations('auth')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [notReady, setNotReady] = useState(false)

  const onToggle = (next: boolean) => {
    setNotReady(false)
    if (!next) {
      onCheckedChange(false)
      return
    }
    if (!ready) {
      setNotReady(true)
      return
    }
    setConfirmOpen(true)
  }

  const confirm = () => {
    setConfirmOpen(false)
    onCheckedChange(true)
  }

  const message = notReady ? tAuth('errSsoEnforceNotReady') : error

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-2.5">
        <div className="min-w-0">
          <Label htmlFor="sso-enforced" className="text-sm font-medium">
            {t('ssoEnforced')}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">{t('ssoEnforcedHint')}</p>
        </div>
        <Switch id="sso-enforced" checked={checked} onCheckedChange={onToggle} />
      </div>
      {checked !== saved && !message && (
        <p className="text-xs text-primary" data-testid="sso-enforce-unsaved">
          {t('ssoEnforceSaveHint')}
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm text-destructive" data-testid="sso-enforce-error">
          {message}
        </p>
      )}

      <ResponsiveModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('ssoEnforceConfirmTitle')}
        description={t('ssoEnforceConfirmIntro')}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirm}>
              {t('ssoEnforceConfirm')}
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1.5 pl-5 text-sm" data-testid="sso-enforce-consequences">
          <li>{t('ssoEnforceConfirmPasswords')}</li>
          <li>{t('ssoEnforceConfirmOwners')}</li>
          <li>{t('ssoEnforceConfirmSessions')}</li>
          <li>{t('ssoEnforceConfirmRestore')}</li>
        </ul>
      </ResponsiveModal>
    </div>
  )
}
