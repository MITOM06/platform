'use client'

import { useTranslations } from 'next-intl'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Label for the confirming (destructive) action. */
  confirmLabel: string
  /** Falls back to the shared `common.cancel` string. */
  cancelLabel?: string
  /** Use the destructive button styling (default true — these are mostly destructive). */
  destructive?: boolean
  onConfirm: () => void
}

/**
 * Generic confirmation dialog used before potentially-irreversible actions such
 * as blocking a user or removing a friend. Mirrors the LogoutConfirmDialog
 * pattern (ResponsiveModal: bottom sheet on mobile, centred dialog on desktop)
 * so confirmations look consistent across the app.
 * Mobile mirror: the AlertDialog confirmations in the Flutter client.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const tCommon = useTranslations('common')

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      desktopClassName="sm:max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel ?? tCommon('cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
