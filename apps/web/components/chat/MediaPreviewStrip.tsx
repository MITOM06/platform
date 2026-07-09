'use client'

import { useTranslations } from 'next-intl'
import { X, Zap } from 'lucide-react'

export interface PendingAttachment {
  id: string
  file: File
  previewUrl: string
  type: 'image' | 'video' | 'file'
  isHD: boolean
}

interface Props {
  attachments: PendingAttachment[]
  onRemove: (id: string) => void
  onToggleHD: (id: string) => void
  onAddMore: () => void
}

/**
 * Messenger-style preview strip that sits above the composer while attachments
 * are staged (not yet uploaded). The user can add more, remove individual
 * items, and toggle HD/SD per image before pressing Send.
 */
export function MediaPreviewStrip({ attachments, onRemove, onToggleHD, onAddMore }: Props) {
  const t = useTranslations('chat')
  if (attachments.length === 0) return null

  return (
    <div className="border-t bg-background/95 px-3 pt-3 pb-1">
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

            {/* HD toggle — images only */}
            {att.type === 'image' && (
              <button
                type="button"
                onClick={() => onToggleHD(att.id)}
                className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors ${
                  att.isHD ? 'bg-pon-cyan/90 text-black' : 'bg-black/50 text-white/70'
                }`}
                title={att.isHD ? t('attachHdOn') : t('attachHdOff')}
              >
                <Zap className="size-2.5" />
                HD
              </button>
            )}
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
