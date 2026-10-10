'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import { authService, type UserProfile } from '@/lib/api/auth'
import type { SelfMfaEnrollStartResponse } from '@/lib/api/types'
import { mfaSelfErrorMessage } from '@/lib/auth/mfa'
import { useAuthStore } from '@/lib/store/auth.store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MfaAlert } from '@/components/auth/mfa/mfa-parts'
import { RegenerateBackupCodesDialog } from '@/components/settings/RegenerateBackupCodesDialog'
import { TwoFactorEnrollPanel } from '@/components/settings/TwoFactorEnrollPanel'
import { TurnOffTwoFactorDialog } from '@/components/settings/TurnOffTwoFactorDialog'

const ME_KEY = ['me'] as const

/**
 * Settings → Security two-factor block (contract 15), shown when the account
 * can use 2FA at all (`/me.mfaAvailable` — not SSO-enforced, not a bot):
 * - required by the role (Owner/Admin-like, `mfaRequired`): the status and
 *   "Regenerate backup codes"; no way to turn it off;
 * - optional (Members), off: a short explanation and "Turn on 2FA", an in-page
 *   flow (QR + key → one code → backup codes once) that changes no session;
 * - optional, on: the status, "Regenerate backup codes" and "Turn off 2FA"
 *   (a current code or a backup code).
 * Mirror of the mobile `two_factor_section.dart`.
 */
export function TwoFactorSection() {
  const t = useTranslations('settings.security')
  const tAuth = useTranslations('auth')
  const qc = useQueryClient()
  const accessToken = useAuthStore((s) => s.accessToken)
  const storeEmail = useAuthStore((s) => s.user?.email ?? '')
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [turnOffOpen, setTurnOffOpen] = useState(false)
  const [setup, setSetup] = useState<SelfMfaEnrollStartResponse | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Same key as the profile editor's `/me` query — one cache entry for the profile.
  const { data: me } = useQuery({
    queryKey: ME_KEY,
    queryFn: () => authService.getMe(),
    enabled: !!accessToken,
  })

  const refreshMe = () => void qc.invalidateQueries({ queryKey: ME_KEY })
  const setMfaEnabled = (mfaEnabled: boolean) =>
    qc.setQueryData<UserProfile>(ME_KEY, (old) => (old ? { ...old, mfaEnabled } : old))

  const start = useMutation({
    mutationFn: () => authService.selfMfaEnrollStart(),
    onSuccess: (res) => setSetup(res),
    onError: (err) => {
      const msg = mfaSelfErrorMessage(err)
      setNotice(tAuth(msg.key, msg.values))
      if (msg.stale) refreshMe()
    },
  })

  if (!me) return null
  // An older server has no `mfaAvailable`: there 2FA applied exactly when required.
  const available = me.mfaAvailable ?? me.mfaRequired === true
  if (!available) return null
  const required = me.mfaRequired === true
  const enabled = me.mfaEnabled === true
  const accountEmail = me.email || storeEmail

  const turnOn = () => {
    setNotice(null)
    start.mutate()
  }

  const body = required
    ? enabled
      ? t('twoFaEnabledBody')
      : t('twoFaPendingBody')
    : enabled
      ? t('twoFaOptionalOnBody')
      : t('twoFaOptionalBody')

  return (
    <section className="space-y-4" data-testid="two-factor-section">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-base">{t('twoFaTitle')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('twoFaSubtitle')}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        {setup ? (
          <TwoFactorEnrollPanel
            setup={setup}
            accountEmail={accountEmail}
            onEnabled={() => setMfaEnabled(true)}
            onDone={() => {
              setSetup(null)
              toast.success(t('turnOnSuccess'))
              refreshMe()
            }}
            onCancel={() => setSetup(null)}
            onAbort={(message, stale) => {
              setSetup(null)
              setNotice(message)
              if (stale) refreshMe()
            }}
          />
        ) : (
          <>
            <div className="flex items-start gap-3">
              <Badge variant={enabled ? 'default' : 'outline'} data-testid="two-factor-status" className="shrink-0">
                {enabled ? t('twoFaOn') : t('twoFaOff')}
              </Badge>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
            {notice && <MfaAlert>{notice}</MfaAlert>}
            <TwoFactorActions
              required={required}
              enabled={enabled}
              starting={start.isPending}
              onTurnOn={turnOn}
              onRegenerate={() => setRegenerateOpen(true)}
              onTurnOff={() => {
                setNotice(null)
                setTurnOffOpen(true)
              }}
            />
          </>
        )}
      </div>

      {enabled && (
        <RegenerateBackupCodesDialog open={regenerateOpen} onOpenChange={setRegenerateOpen} accountEmail={accountEmail} />
      )}
      {/* Always mounted: the `/me` refetch after an error (e.g. MFA_REQUIRED_BY_ROLE)
          must not unmount it while it shows that message. */}
      <TurnOffTwoFactorDialog
        open={turnOffOpen}
        onOpenChange={setTurnOffOpen}
        onTurnedOff={() => {
          setMfaEnabled(false)
          toast.success(t('turnOffSuccess'))
          refreshMe()
        }}
        onStale={refreshMe}
      />
    </section>
  )
}

function TwoFactorActions({
  required,
  enabled,
  starting,
  onTurnOn,
  onRegenerate,
  onTurnOff,
}: {
  required: boolean
  enabled: boolean
  starting: boolean
  onTurnOn: () => void
  onRegenerate: () => void
  onTurnOff: () => void
}) {
  const t = useTranslations('settings.security')
  if (!enabled && required) return null
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {!enabled && (
        <Button className="gap-2" onClick={onTurnOn} disabled={starting}>
          {starting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" />}
          {t('turnOnButton')}
        </Button>
      )}
      {enabled && !required && (
        <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={onTurnOff}>
          <ShieldOff className="size-4" />
          {t('turnOffButton')}
        </Button>
      )}
      {enabled && (
        <Button variant="outline" className="gap-2" onClick={onRegenerate}>
          <KeyRound className="size-4" />
          {t('regenerateButton')}
        </Button>
      )}
    </div>
  )
}
