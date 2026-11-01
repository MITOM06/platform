'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { authService } from '@/lib/api/auth'
import { parseAuthError } from '@/lib/auth/auth-error'
import { InviteAcceptForm } from '@/components/auth/InviteAcceptForm'
import { InviteStatusCard } from '@/components/auth/InviteStatusCard'
import { isInviteRetryNotice } from '@/lib/auth/invite-return'

/**
 * Public invitation landing page — the link mailed to the invitee
 * (`${WEB_ORIGIN}/invite/<token>`). Guest-only (middleware bounces signed-in
 * users home). Previews the invitation, then lets the invitee accept with
 * Google or by setting a password. A cancelled / refused Google attempt comes
 * back here with `?reason=CODE` (allow-listed) to try again.
 */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const rawReason = useSearchParams()?.get('reason')
  const notice = isInviteRetryNotice(rawReason) ? rawReason : null
  const t = useTranslations('auth.invite')

  const { data, error, isPending } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => authService.getInvitation(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  })
  // Same source as the login page: is "Continue with Google" configured?
  const { data: sso } = useQuery({
    queryKey: ['sso-info'],
    queryFn: () => authService.getSsoInfo(),
    staleTime: 5 * 60 * 1000,
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return <InviteStatusCard code={error ? parseAuthError(error).code : 'INVITATION_INVALID'} />
  }

  // Hidden only when the server says Google is off (older servers omit the flag).
  return (
    <InviteAcceptForm
      token={token}
      preview={data}
      googleEnabled={sso?.googleEnabled !== false}
      notice={notice}
    />
  )
}
