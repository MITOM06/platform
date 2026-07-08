'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  /**
   * Render the header (title/description) visually hidden but still present for
   * screen readers. Use when the content provides its own visual header and a
   * visible DialogTitle would overlap it — while keeping Radix's required title
   * for accessibility.
   */
  hideTitle?: boolean
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  hideTitle = false,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile()
  const t = useTranslations('common')

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn('max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-safe', className)}
        >
          {(title || description) && (
            <SheetHeader className={cn(hideTitle && 'sr-only')}>
              {title && <SheetTitle>{title}</SheetTitle>}
              {description && <SheetDescription>{description}</SheetDescription>}
            </SheetHeader>
          )}
          {!title && <SheetTitle className="sr-only">{t('dialogTitle')}</SheetTitle>}
          {!description && <SheetDescription className="sr-only">{t('dialogDescription')}</SheetDescription>}
          {children}
          {footer && <SheetFooter>{footer}</SheetFooter>}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[90dvh] overflow-y-auto', className)}>
        {(title || description) && (
          <DialogHeader className={cn(hideTitle && 'sr-only')}>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {!title && <DialogTitle className="sr-only">{t('dialogTitle')}</DialogTitle>}
        {!description && <DialogDescription className="sr-only">{t('dialogDescription')}</DialogDescription>}
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
