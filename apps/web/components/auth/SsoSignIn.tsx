'use client'

import { KeyRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AUTH_URL } from '@/lib/config/env'
import { cn } from '@/lib/utils'

/** Start of the OIDC sign-in (auth-service redirects to the company IdP). */
export function ssoLoginHref(): string {
  return `${AUTH_URL}/auth/oidc/login?platform=web`
}

/**
 * "Sign in with SSO". `emphasised` when the workspace requires SSO (or the
 * server just answered `SSO_REQUIRED`): a filled primary button instead of the
 * outline one, so it reads as the way in.
 */
export function SsoButton({ emphasised = false, className }: { emphasised?: boolean; className?: string }) {
  const t = useTranslations('auth.login')
  return (
    <a
      href={ssoLoginHref()}
      data-testid="sso-button"
      data-emphasised={emphasised ? 'true' : 'false'}
      className={cn(
        'flex items-center justify-center gap-2 w-full rounded-[10px] px-4 text-sm transition-colors',
        emphasised
          ? 'h-11 bg-primary text-primary-foreground font-bold tracking-wide hover:bg-primary/90'
          : 'py-2 border border-border font-medium hover:bg-muted',
        className,
      )}
    >
      <KeyRound className="size-4" aria-hidden />
      {t('ssoButton')}
    </a>
  )
}

/**
 * Persistent notice that single sign-on is required for this account
 * (`SSO_REQUIRED`): informational, not an error — the user simply has to use
 * the SSO button. The message is always a localized string.
 */
export function SsoRequiredNotice({ message, className }: { message: string; className?: string }) {
  return (
    <div
      role="alert"
      data-testid="sso-required-notice"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground',
        className,
      )}
    >
      <KeyRound className="size-4 mt-0.5 shrink-0 text-primary" aria-hidden />
      <span>{message}</span>
    </div>
  )
}
