'use client'

import { useTranslations } from 'next-intl'
import { Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { meetingLink } from '@/lib/meetings/meeting-code'

interface Props {
  code: string
  /** `icon` for list rows, `button` (with text) for the detail page. */
  variant?: 'icon' | 'button'
  className?: string
}

export function CopyLinkButton({ code, variant = 'icon', className }: Props) {
  const t = useTranslations('meeting')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink(code, window.location.origin))
      toast.success(t('linkCopied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  if (variant === 'button') {
    return (
      <Button type="button" variant="outline" size="sm" onClick={copy} className={className}>
        <Link2 className="size-4" />
        {t('copyLink')}
      </Button>
    )
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={copy}
      aria-label={t('copyLink')}
      title={t('copyLink')}
      className={className}
    >
      <Link2 className="size-4" />
    </Button>
  )
}
