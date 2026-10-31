'use client'

import { useSyncExternalStore } from 'react'
import { KeyRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AUTH_URL } from '@/lib/config/env'
import { isSsoReauthDue, subscribeSsoReauth } from '@/lib/auth/sso-reauth'
import { cn } from '@/lib/utils'

/**
 * Start of the OIDC sign-in (auth-service redirects to the company IdP).
 * `reauth`: someone signed out on this device, so the IdP must ask again instead
 * of silently re-entering their account (see `lib/auth/sso-reauth.ts`).
 */
export function ssoLoginHref(reauth = false): string {
  return `${AUTH_URL}/auth/oidc/login?platform=web${reauth ? '&reauth=1' : ''}`
}

const noReauthOnServer = () => false

/**
 * "Sign in with SSO". `emphasised` when the workspace requires SSO (or the
 * server just answered `SSO_REQUIRED`): a filled primary button instead of the
 * outline one, so it reads as the way in.
 */
export function SsoButton({ emphasised = false, className }: { emphasised?: boolean; className?: string }) {
  const t = useTranslations('auth.login')
  // Through this hook, not read directly: the server has no localStorage, and
  // React would keep the server's href on hydration. In the href (not onClick),
  // so opening the link in a new tab sends the flag too.
  const reauth = useSyncExternalStore(subscribeSsoReauth, isSsoReauthDue, noReauthOnServer)
  return (
    <a
      href={ssoLoginHref(reauth)}
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
