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
  /** Body content. Optional — a plain confirm is just a title, description and footer. */
  children?: ReactNode
  footer?: ReactNode
  /** Applied to BOTH branches. Only put here what is correct for a sheet AND a dialog. */
  className?: string
  /**
   * Classes for the desktop Dialog only. This is where width caps belong:
   * `useIsMobile` flips to the bottom sheet below 768px, but a `sm:` utility is
   * live from 640px up — so a `sm:max-w-md` passed via `className` would squeeze
   * the sheet to 28rem on a 700px-wide tablet and leave it hanging off-centre.
   */
  desktopClassName?: string
  /** Classes for the mobile bottom Sheet only. */
  mobileClassName?: string
  /** Hide the built-in close (X) — for content that supplies its own. */
  showCloseButton?: boolean
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
  desktopClassName,
  mobileClassName,
  showCloseButton = true,
  hideTitle = false,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile()
  const t = useTranslations('common')

  if (isMobile) {
    // Padding lives on the container here, matching DialogContent, so the
    // `{children}` body is inset too — SheetContent ships none of its own and
    // the body would otherwise run edge-to-edge. SheetHeader/SheetFooter carry
    // their own `p-6`, which would then double up, hence `p-0` on both.
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={showCloseButton}
          className={cn(
            'max-h-[90dvh] overflow-y-auto rounded-t-2xl p-6 pb-safe-6',
            className,
            mobileClassName,
          )}
        >
          {(title || description) && (
            <SheetHeader className={cn('p-0', hideTitle && 'sr-only')}>
              {title && <SheetTitle>{title}</SheetTitle>}
              {description && <SheetDescription>{description}</SheetDescription>}
            </SheetHeader>
          )}
          {!title && <SheetTitle className="sr-only">{t('dialogTitle')}</SheetTitle>}
          {!description && <SheetDescription className="sr-only">{t('dialogDescription')}</SheetDescription>}
          {children}
          {footer && <SheetFooter className="p-0">{footer}</SheetFooter>}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={showCloseButton}
        className={cn('max-h-[90dvh] overflow-y-auto', className, desktopClassName)}
      >
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
