'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { authService } from '@/lib/api/auth'
import { parseAuthError } from '@/lib/auth/auth-error'
import { InviteAcceptForm } from '@/components/auth/InviteAcceptForm'
import { InviteStatusCard } from '@/components/auth/InviteStatusCard'

/**
 * Public invitation landing page — the link mailed to the invitee
 * (`${WEB_ORIGIN}/invite/<token>`). Guest-only (middleware bounces signed-in
 * users home). Previews the invitation, then lets the invitee accept with
 * Google or by setting a password.
 */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const t = useTranslations('auth.invite')

  const { data, error, isPending } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => authService.getInvitation(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
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

  return <InviteAcceptForm token={token} preview={data} />
}
