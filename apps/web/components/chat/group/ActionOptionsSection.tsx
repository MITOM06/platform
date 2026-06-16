'use client'

import { useTranslations } from 'next-intl'
import { CheckCheck, BookMarked, Archive, ArchiveX, Timer } from 'lucide-react'
import {
  AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { Slider } from '@/components/ui/slider'

const ROW_CLS = 'flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors'

interface Props {
  saving: boolean
  isArchived: boolean
  autoDeleteOptions: { label: string; value: number }[]
  sliderValue: number
  onMarkRead: () => void
  onMarkUnread: () => void
  onArchiveToggle: () => void
  onAutoDelete: (idx: number) => void
}

/** Mark read/unread, archive toggle, and auto-delete timer (web-specific). */
export function ActionOptionsSection({
  saving,
  isArchived,
  autoDeleteOptions,
  sliderValue,
  onMarkRead,
  onMarkUnread,
  onArchiveToggle,
  onAutoDelete,
}: Props) {
  const t = useTranslations('chat')
  return (
    <AccordionItem value="options" className="border-none">
      <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-pon-cyan">
        <span className="font-semibold text-sm">{t('actionOptions')}</span>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-1 space-y-1">
        <button onClick={onMarkRead} disabled={saving} className={ROW_CLS}>
          <CheckCheck className="size-4 text-muted-foreground" />
          <span>{t('markRead')}</span>
        </button>
        <button onClick={onMarkUnread} disabled={saving} className={ROW_CLS}>
          <BookMarked className="size-4 text-muted-foreground" />
          <span>{t('markUnread')}</span>
        </button>
        <button onClick={onArchiveToggle} disabled={saving} className={ROW_CLS}>
          {isArchived ? <ArchiveX className="size-4 text-muted-foreground" /> : <Archive className="size-4 text-muted-foreground" />}
          <span>{isArchived ? t('unarchive') : t('archive')}</span>
        </button>

        <div className="px-2 py-3 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Timer className="size-4 text-muted-foreground" />
            <span>{t('autoDelete')}</span>
          </div>
          <Slider
            min={0}
            max={autoDeleteOptions.length - 1}
            step={1}
            value={[sliderValue]}
            onValueChange={([v]) => onAutoDelete(v)}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
            {autoDeleteOptions.map((o, i) => (
              <span key={i} className={i === sliderValue ? 'text-primary' : ''}>
                {o.label}
              </span>
            ))}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
