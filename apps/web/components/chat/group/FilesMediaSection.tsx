'use client'

import { useTranslations } from 'next-intl'
import { Image as ImageIcon2, FileText, Link as LinkIcon } from 'lucide-react'
import {
  AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'

const ROW_CLS = 'flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors'

interface Props {
  onOpenSharedMedia: () => void
}

/** Shared media / files / links shortcuts. */
export function FilesMediaSection({ onOpenSharedMedia }: Props) {
  const t = useTranslations('chat')
  return (
    <AccordionItem value="media" className="border-none">
      <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-pon-cyan">
        <span className="font-semibold text-sm">{t('filesAndMediaCategory')}</span>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-1 space-y-1">
        <button className={ROW_CLS} onClick={onOpenSharedMedia}>
          <ImageIcon2 className="size-4 text-muted-foreground" />
          <span>{t('tabMedia')}</span>
        </button>
        <button className={ROW_CLS} onClick={onOpenSharedMedia}>
          <FileText className="size-4 text-muted-foreground" />
          <span>{t('tabFiles')}</span>
        </button>
        <button className={ROW_CLS} onClick={onOpenSharedMedia}>
          <LinkIcon className="size-4 text-muted-foreground" />
          <span>{t('tabLinks')}</span>
        </button>
      </AccordionContent>
    </AccordionItem>
  )
}
