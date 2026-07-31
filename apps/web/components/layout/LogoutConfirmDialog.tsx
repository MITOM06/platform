'use client'

import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'

interface LogoutConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Runs the existing logout flow when the user confirms. */
  onConfirm: () => void
}

/**
 * Confirmation dialog shown before signing the user out. Used by both logout
 * triggers (SidebarProfileBar dropdown + Settings page card) so the flow is
 * consistent. Mobile mirror: the logout confirm dialog in settings_screen.dart.
 */
export function LogoutConfirmDialog({ open, onOpenChange, onConfirm }: LogoutConfirmDialogProps) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      desktopClassName="sm:max-w-sm"
      title={
        <span className="flex items-center gap-2">
          <span className="size-8 rounded-full bg-destructive/10 flex items-center justify-center">
            <LogOut className="size-4 text-destructive" />
          </span>
          {t('logoutConfirmTitle')}
        </span>
      }
      description={t('logoutConfirmMessage')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
          >
            {t('logout')}
          </Button>
        </>
      }
    />
  )
}
