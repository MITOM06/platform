'use client'

import { useTranslations } from 'next-intl'
import { Phone, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { humanizeSystemMessage } from '@/lib/system-messages'

interface Props {
  content: string
  resolveName: (actorId: string) => string | undefined
}

/**
 * Centered pill for a structured system event (member joined, message pinned, call ended…).
 * The raw `system.*` code is always humanised — parity with Flutter `system_message.dart`.
 */
export function SystemMessageBubble({ content, resolveName }: Props) {
  const t = useTranslations('chat')
  const systemText = humanizeSystemMessage(content, t, { resolveName })
  const isCallMsg = content.startsWith('system.call.')
  const isVideoCall = isCallMsg && content.includes(':video')
  const isMissedCall = isCallMsg && content.startsWith('system.call.missed:')
  return (
    <div className="flex justify-center my-1">
      <span
        className={cn(
          'flex items-center gap-1.5 text-[11px] font-medium rounded-full px-3 py-1.5',
          isCallMsg
            ? isMissedCall
              ? 'text-destructive bg-destructive/10'
              : 'text-primary bg-primary/10 dark:bg-primary/20'
            : 'text-muted-foreground bg-muted/65 border border-border/20',
        )}
      >
        {isCallMsg && (isVideoCall
          ? <Video className="size-3 shrink-0" />
          : <Phone className="size-3 shrink-0" />
        )}
        {systemText}
      </span>
    </div>
  )
}
