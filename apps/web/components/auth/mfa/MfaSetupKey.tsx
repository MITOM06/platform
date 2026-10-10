'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import type { MfaEnrollStartResponse } from '@/lib/api/types'
import { Button } from '@/components/ui/button'

/** Base32 secret in groups of four, easier to type by hand. Copy uses the raw value. */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim()
}

/**
 * The authenticator setup material: QR code, "open in app" link (phones) and
 * the manual key with Copy. Shared by the sign-in enrollment on `/mfa` and the
 * optional "Turn on 2FA" flow in Settings → Security.
 */
export function MfaSetupKey({ setup }: { setup: MfaEnrollStartResponse }) {
  const t = useTranslations('auth.mfa')

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(setup.secret)
      toast.success(t('keyCopied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  return (
    <div className="space-y-3">
      <Image
        src={setup.qrDataUrl}
        alt={t('qrAlt')}
        width={192}
        height={192}
        unoptimized
        className="mx-auto rounded-lg bg-white p-2"
      />
      <a
        href={setup.otpauthUrl}
        className="block text-center text-sm font-medium text-primary hover:underline underline-offset-4 md:hidden"
      >
        {t('openInApp')}
      </a>
      <p className="text-xs text-muted-foreground">{t('manualKeyLabel')}</p>
      <div className="flex items-center gap-2">
        <code
          data-testid="mfa-secret"
          className="min-w-0 flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm tracking-wider select-all"
        >
          {groupSecret(setup.secret)}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={t('copyKey')}
          aria-label={t('copyKey')}
          onClick={() => void copySecret()}
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  )
}
