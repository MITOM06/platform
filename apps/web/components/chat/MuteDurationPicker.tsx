'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const MUTE_OPTIONS = [
  { labelKey: 'mute15min',   seconds: 900   },
  { labelKey: 'mute30min',   seconds: 1800  },
  { labelKey: 'mute1hour',   seconds: 3600  },
  { labelKey: 'mute24hours', seconds: 86400 },
  { labelKey: 'muteForever', seconds: -1    },
] as const

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (durationSeconds: number) => void
}

/**
 * A small dialog that lets the user pick a mute duration before muting.
 * Used in ConversationSettingsDrawer so the drawer mute button matches the
 * context-menu submenu in ConversationItem.
 */
export function MuteDurationPicker({ open, onClose, onSelect }: Props) {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{t('muteNotifications')}</DialogTitle>
          <DialogDescription className="sr-only">{t('muteNotifications')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1 py-1">
          {MUTE_OPTIONS.map(({ labelKey, seconds }) => (
            <Button
              key={seconds}
              variant="ghost"
              className="justify-start h-10 px-3 text-sm"
              onClick={() => onSelect(seconds)}
            >
              {t(labelKey)}
            </Button>
          ))}
        </div>
        <div className="pt-1">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
