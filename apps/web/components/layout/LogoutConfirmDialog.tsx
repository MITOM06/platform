'use client'

import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <LogOut className="size-4 text-destructive" />
            </div>
            {t('logoutConfirmTitle')}
          </DialogTitle>
          <DialogDescription>{t('logoutConfirmMessage')}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
