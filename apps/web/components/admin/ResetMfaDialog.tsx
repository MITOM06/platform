'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { useResetMemberMfa } from '@/lib/hooks/use-admin'
import type { Member } from '@/lib/api/admin-types'

interface Props {
  /** The member whose 2FA is about to be reset; `null` = closed. */
  member: Member | null
  onClose: () => void
}

/**
 * Owner-only confirmation for "Reset 2FA": the member is signed out everywhere
 * and has to set up their authenticator again at the next sign-in.
 */
export function ResetMfaDialog({ member, onClose }: Props) {
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
      description={member ? t('memberMfaResetConfirm', { name: member.displayName }) : undefined}
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
