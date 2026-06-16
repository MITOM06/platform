'use client'

import { Pin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  /** Truncated message content to display. */
  content: string
  /** Optional sender label rendered above the content. */
  senderLabel?: string
  /** Called when the row body is clicked (e.g. jump to message). */
  onJump?: () => void
  /** Called when the unpin (X) button is clicked. */
  onUnpin?: () => void
  /** Accessible / tooltip label for the unpin button. */
  unpinLabel?: string
}

/**
 * Shared pinned-message row UI.
 * Used by both PinnedMessagesBar (header) and the info-panel pinned section.
 * Mobile mirror: pinned_messages_section.dart.
 */
export function PinnedMessageRow({
  content,
  senderLabel,
  onJump,
  onUnpin,
  unpinLabel,
}: Props) {
  return (
    <div
      className="bg-pon-cyan/10 border-l-[3px] border-l-pon-cyan px-3 py-1.5 flex items-center gap-2 rounded-r-md transition-colors hover:bg-pon-cyan/15 shrink-0"
      onClick={onJump}
      role={onJump ? 'button' : undefined}
      style={onJump ? { cursor: 'pointer' } : undefined}
    >
      <Pin className="size-3.5 text-pon-cyan shrink-0" />
      <div className="flex-1 min-w-0">
        {senderLabel && (
          <p className="text-[11px] text-pon-cyan font-semibold truncate">{senderLabel}</p>
        )}
        <p className="text-xs text-foreground truncate">{content}</p>
      </div>
      {onUnpin && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation()
            onUnpin()
          }}
          title={unpinLabel}
          className="size-6 shrink-0 hover:bg-foreground/10 rounded-full"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}
