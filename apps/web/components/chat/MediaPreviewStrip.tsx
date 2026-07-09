'use client'

import { useTranslations } from 'next-intl'
import { X, Zap } from 'lucide-react'

export interface PendingAttachment {
  id: string
  file: File
  previewUrl: string
  type: 'image' | 'video' | 'file'
  // HD is now a single global flag on the composer (see `isAllHD`), not
  // per-attachment — one toggle applies to every staged image.
}

interface Props {
  attachments: PendingAttachment[]
  isAllHD: boolean
  onRemove: (id: string) => void
  onToggleAllHD: () => void
  onAddMore: () => void
}

/**
 * Messenger-style preview strip that sits above the composer while attachments
 * are staged (not yet uploaded). The user can add more, remove individual
 * items, and toggle HD/SD for the whole batch with a single global button
 * before pressing Send.
 */
export function MediaPreviewStrip({
  attachments,
  isAllHD,
  onRemove,
  onToggleAllHD,
  onAddMore,
}: Props) {
  const t = useTranslations('chat')
  if (attachments.length === 0) return null
  const hasImages = attachments.some((a) => a.type === 'image')

  return (
    <div className="border-t bg-background/95 px-3 pt-2 pb-1">
      {/* Header: single global HD toggle (images only) */}
      {hasImages && (
        <div className="flex items-center justify-end mb-2">
          <button
            type="button"
            onClick={onToggleAllHD}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
              isAllHD
                ? 'bg-pon-cyan/20 text-pon-cyan border border-pon-cyan/40'
                : 'bg-muted/60 text-muted-foreground border border-border'
            }`}
            title={isAllHD ? t('attachHdOn') : t('attachHdOff')}
          >
            <Zap className="size-3" />
            {isAllHD ? t('hdOn') : t('hdOff')}
          </button>
        </div>
      )}

      {/* Thumbnails — no per-thumbnail HD button anymore */}
      <div className="flex items-start gap-2 overflow-x-auto no-scrollbar">
        {attachments.map((att) => (
          <div key={att.id} className="relative shrink-0 group">
            {att.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={att.previewUrl}
                alt=""
                className="size-20 object-cover rounded-xl border border-border"
              />
            ) : att.type === 'video' ? (
              <div className="size-20 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden">
                <video src={att.previewUrl} className="size-full object-cover" muted />
              </div>
            ) : (
              <div className="w-28 h-20 rounded-xl border border-border bg-muted flex flex-col items-center justify-center gap-1 px-2">
                <span className="text-2xl">📄</span>
                <span className="text-[10px] text-muted-foreground text-center line-clamp-2 leading-tight">
                  {att.file.name}
                </span>
              </div>
            )}

            {/* Remove button */}
            <button
              type="button"
              onClick={() => onRemove(att.id)}
              className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
              aria-label={t('removeAttachment')}
            >
              <X className="size-3" />
            </button>
          </div>
        ))}

        {/* Add more — images/videos only (files are single-shot) */}
        {attachments[0]?.type !== 'file' && (
          <button
            type="button"
            onClick={onAddMore}
            title={t('addMore')}
            className="size-20 shrink-0 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-pon-cyan hover:text-pon-cyan transition-colors"
          >
            <span className="text-2xl leading-none">+</span>
          </button>
        )}
      </div>
    </div>
  )
}
