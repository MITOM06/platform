'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { useResetMemberMfa } from '@/lib/hooks/use-admin'
import type { Member } from '@/lib/api/admin-types'

interface Props {
  /** The member whose 2FA is about to be reset; `null` = closed. */
  member: Member | null
  /**
   * The member's role makes 2FA mandatory (Owner/Admin-like). `false` = a
   * Member, for whom 2FA is optional; `null` = unknown (mandatory wording).
   */
  targetPrivileged: boolean | null
  onClose: () => void
}

/**
 * Confirmation for "Reset 2FA" (Owner, or a member manager on a non-admin
 * member — see `canResetMemberMfa`): the member is signed out everywhere.
 * An Owner/Admin-like member must set up 2FA again at the next sign-in; for a
 * Member 2FA is simply off until they turn it on again (contract 15).
 */
export function ResetMfaDialog({ member, targetPrivileged, onClose }: Props) {
  const t = useTranslations('admin')
  const reset = useResetMemberMfa()

  const confirm = () => {
    if (!member) return
    reset.mutate(member._id, { onSettled: onClose })
  }

  return (
    <ResponsiveModal
      open={!!member}
      onOpenChange={(o) => !o && onClose()}
      title={t('memberMfaResetTitle')}
      description={
        member
          ? t(targetPrivileged === false ? 'memberMfaResetConfirmOptional' : 'memberMfaResetConfirm', {
              name: member.displayName,
            })
          : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={reset.isPending}>
            {t('memberMfaReset')}
          </Button>
        </>
      }
    />
  )
}
