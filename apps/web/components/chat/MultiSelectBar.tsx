'use client'

import { useTranslations } from 'next-intl'
import { X, Share2, Trash, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  selectedCount: number
  /** True when every selected message is the current user's own and recallable. */
  canRecall: boolean
  onCancel: () => void
  onForward: () => void
  onDelete: () => void
  onRecall: () => void
}

/**
 * Bottom action bar shown in place of the composer while multi-select is
 * active. Mirrors the composer's rounded/blur surface.
 */
export function MultiSelectBar({
  selectedCount,
  canRecall,
  onCancel,
  onForward,
  onDelete,
  onRecall,
}: Props) {
  const t = useTranslations('chat')
  const empty = selectedCount === 0

  return (
    <div className="border-t bg-background/95 backdrop-blur-md pb-safe">
      {/* Count row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-sm font-semibold text-foreground">
          {empty ? t('multiSelectEmpty') : t('multiSelectCount', { count: selectedCount })}
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 px-2 text-xs gap-1">
          <X className="size-3.5" />
          {t('multiSelectCancel')}
        </Button>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          disabled={empty}
          onClick={onForward}
        >
          <Share2 className="size-3.5" />
          {t('forwardAction')}
        </Button>

        {canRecall && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
            disabled={empty}
            onClick={onRecall}
          >
            <Trash2 className="size-3.5" />
            {t('recallAction')}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={empty}
          onClick={onDelete}
        >
          <Trash className="size-3.5" />
          {t('deleteForMeAction')}
        </Button>
      </div>
    </div>
  )
}
