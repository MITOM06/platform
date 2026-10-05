'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { authService } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth.store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RegenerateBackupCodesDialog } from '@/components/settings/RegenerateBackupCodesDialog'

/**
 * Settings → Security two-factor block. 2FA exists only for privileged roles
 * (`mfaRequired` on `/api/users/me`); everyone else sees nothing. It is
 * mandatory for them, so there is no "turn off" — only the status and
 * "Regenerate backup codes". Mirror of the mobile security settings screen.
 */
export function TwoFactorSection() {
  const t = useTranslations('settings.security')
  const accessToken = useAuthStore((s) => s.accessToken)
  const storeEmail = useAuthStore((s) => s.user?.email ?? '')
  const [open, setOpen] = useState(false)

  // Same key as the profile editor's `/me` query — one cache entry for the profile.
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe(),
    enabled: !!accessToken,
  })

  if (!me?.mfaRequired) return null
  const enabled = me.mfaEnabled === true

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
        <div className="flex items-start gap-3">
          <Badge variant={enabled ? 'default' : 'outline'} data-testid="two-factor-status" className="shrink-0">
            {enabled ? t('twoFaOn') : t('twoFaOff')}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {enabled ? t('twoFaEnabledBody') : t('twoFaPendingBody')}
          </p>
        </div>
        {enabled && (
          <div className="flex justify-end">
            <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
              <KeyRound className="size-4" />
              {t('regenerateButton')}
            </Button>
          </div>
        )}
      </div>

      {enabled && (
        <RegenerateBackupCodesDialog open={open} onOpenChange={setOpen} accountEmail={me.email || storeEmail} />
      )}
    </section>
  )
}
