'use client'

import { useTranslations } from 'next-intl'
import { Shield, ShieldOff, LogOut, Eraser, Trash2 } from 'lucide-react'
import {
  AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'

const ROW_CLS = 'flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-destructive/10 text-destructive rounded-lg text-sm transition-colors'

interface Props {
  isDirect: boolean
  isGroup: boolean
  isAI: boolean
  isBlocked: boolean
  saving: boolean
  onBlockToggle: () => void
  onLeaveGroup: () => void
  onClearHistory: () => void
  onDelete: () => void
}

/** Block, leave group, clear history, delete conversation (destructive). */
export function PrivacySupportSection({
  isDirect,
  isGroup,
  isAI,
  isBlocked,
  saving,
  onBlockToggle,
  onLeaveGroup,
  onClearHistory,
  onDelete,
}: Props) {
  const t = useTranslations('chat')
  return (
    <AccordionItem value="privacy" className="border-none">
      <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-red-500">
        <span className="font-semibold text-sm">{t('privacyAndSupportCategory')}</span>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-1 space-y-1">
        {isDirect && !isAI && (
          <button onClick={onBlockToggle} disabled={saving} className={ROW_CLS}>
            {isBlocked ? <Shield className="size-4" /> : <ShieldOff className="size-4" />}
            <span>{isBlocked ? t('unblockUser') : t('blockUser')}</span>
          </button>
        )}
        {isGroup && (
          <button onClick={onLeaveGroup} disabled={saving} className={ROW_CLS}>
            <LogOut className="size-4" />
            <span>{t('leaveGroup')}</span>
          </button>
        )}
        <button onClick={onClearHistory} disabled={saving} className={ROW_CLS}>
          <Eraser className="size-4" />
          <span>{t('clearHistory')}</span>
        </button>
        <button onClick={onDelete} disabled={saving} className={ROW_CLS}>
          <Trash2 className="size-4" />
          <span>{t('deleteConversation')}</span>
        </button>
      </AccordionContent>
    </AccordionItem>
  )
}
