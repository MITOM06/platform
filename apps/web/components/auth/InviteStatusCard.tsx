'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { CircleAlert, CircleCheck, Clock, Ban } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authCodeToI18nKey } from '@/lib/auth/auth-error'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface StatusCopy {
  icon: LucideIcon
  title: string
  body: string
  action: 'goToLogin' | 'backToLogin'
}

/** Keys under `auth.invite` for the four terminal invitation states. */
const KNOWN: Record<string, Omit<StatusCopy, 'title' | 'body'> & { key: string }> = {
  INVITATION_INVALID: { icon: CircleAlert, key: 'invalid', action: 'backToLogin' },
  INVITATION_EXPIRED: { icon: Clock, key: 'expired', action: 'backToLogin' },
  INVITATION_REVOKED: { icon: Ban, key: 'revoked', action: 'backToLogin' },
  INVITATION_ALREADY_ACCEPTED: { icon: CircleCheck, key: 'accepted', action: 'goToLogin' },
}

/**
 * Terminal state of an invitation link (invalid / expired / revoked / already
 * accepted). Any other error code (network, rate limit…) renders its localized
 * `auth.*` message — never the raw server text.
 */
export function InviteStatusCard({ code }: { code: string }) {
  const t = useTranslations('auth')
  const known = KNOWN[code]
  const copy: StatusCopy = known
    ? {
        icon: known.icon,
        title: t(`invite.${known.key}Title`),
        body: t(`invite.${known.key}Body`),
        action: known.action,
      }
    : { icon: CircleAlert, title: t(authCodeToI18nKey(code)), body: '', action: 'backToLogin' }
  const Icon = copy.icon

  return (
    <Card className="w-full max-w-md shadow-none border-border">
      <CardHeader className="items-center text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <CardTitle className="text-xl">{copy.title}</CardTitle>
        {copy.body && <CardDescription>{copy.body}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full h-11" variant={copy.action === 'goToLogin' ? 'default' : 'outline'}>
          <Link href="/login">{t(`invite.${copy.action}`)}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
