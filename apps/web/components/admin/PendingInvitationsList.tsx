'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { RotateCw, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import {
  useInvitations,
  useResendInvitation,
  useRevokeInvitation,
} from '@/lib/hooks/use-admin'
import type { Invitation } from '@/lib/api/admin-types'

/**
 * Actionable invitations (pending + expired) shown above the members list.
 * Renders nothing when there are none. Resend rotates the link server-side;
 * Revoke asks for confirmation first.
 */
export function PendingInvitationsList({ enabled = true }: { enabled?: boolean }) {
  const t = useTranslations('admin')
  const tChat = useTranslations('chat')
  const format = useFormatter()
  const { data: invitations = [] } = useInvitations(enabled)
  const resend = useResendInvitation()
  const revoke = useRevokeInvitation()
  const [revoking, setRevoking] = useState<Invitation | null>(null)

  const actionable = invitations.filter((i) => i.status === 'pending' || i.status === 'expired')
  if (actionable.length === 0) return null

  const confirmRevoke = () => {
    if (!revoking) return
    revoke.mutate(revoking._id, { onSettled: () => setRevoking(null) })
  }

  return (
    <section className="space-y-2 pb-4" aria-label={t('pendingInvitations')}>
      <h3 className="text-sm font-semibold">{t('pendingInvitations')}</h3>
      {actionable.map((inv) => {
        const expired = inv.status === 'expired'
        return (
          <div
            key={inv._id}
            data-testid="invitation-row"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{inv.email}</p>
              <p className="text-xs text-muted-foreground truncate">
                {t('inviteExpires', {
                  date: format.dateTime(new Date(inv.expiresAt), { dateStyle: 'medium' }),
                })}
                {' · '}
                {t('inviteInvitedBy', { name: inv.invitedBy.displayName ?? tChat('someone') })}
              </p>
            </div>
            {inv.roleName && <Badge variant="secondary">{inv.roleName}</Badge>}
            <Badge variant={expired ? 'destructive' : 'outline'}>
              {t(expired ? 'inviteStatusExpired' : 'inviteStatusPending')}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="tap"
              title={t('inviteResend')}
              aria-label={t('inviteResend')}
              disabled={resend.isPending && resend.variables === inv._id}
              onClick={() => resend.mutate(inv._id)}
            >
              <RotateCw className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="tap"
              title={t('inviteRevoke')}
              aria-label={t('inviteRevoke')}
              onClick={() => setRevoking(inv)}
            >
              <X className="size-4" />
            </Button>
          </div>
        )
      })}

      <ResponsiveModal
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={t('inviteRevoke')}
        description={revoking ? t('inviteRevokeConfirm', { email: revoking.email }) : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setRevoking(null)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmRevoke} disabled={revoke.isPending}>
              {t('inviteRevoke')}
            </Button>
          </>
        }
      />
    </section>
  )
}
