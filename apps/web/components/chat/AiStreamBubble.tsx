'use client'

import { useTranslations } from 'next-intl'
import { ShieldAlert, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BUILTIN_TOOL_LABEL_KEYS } from '@/lib/ai/connector-names'
import type { AiStreamEntry } from '@/lib/ai/stream-routing'
import { AiActionCard } from './AiActionCard'

/**
 * Localized label of an in-progress tool call. Connector tools are named
 * `mcp__<provider>__<tool>` (provider may be `custom_<24hex>`) — machine ids that
 * must never be shown, so anything unmapped gets a generic localized label.
 */
function toolLabelKey(tool: string): string {
  return (
    BUILTIN_TOOL_LABEL_KEYS[tool] ??
    (tool.startsWith('mcp__') ? 'aiToolCallingConnector' : 'aiToolCallingGeneric')
  )
}

/**
 * One AI reply while it streams (parity with Flutter StreamingAiBubble): "thinking"
 * dots before the first chunk, the active tool, then streamed text with a cursor,
 * plus a confirmation card for every sensitive action the reply holds (F2).
 */
export function AiStreamBubble({
  stream,
  conversationId,
}: {
  stream: AiStreamEntry
  conversationId: string
}) {
  const t = useTranslations('chat')
  const tool = stream.activeTools[stream.activeTools.length - 1]
  const isSensitive = !!tool && stream.sensitiveTools.includes(tool)

  return (
    <div className="flex flex-row items-end gap-1 motion-safe:pon-enter" data-testid="ai-stream-bubble">
      <div className="max-w-[70%] lg:max-w-[640px] rounded-[14px] rounded-tl-[4px] px-4 py-2.5 text-sm bg-muted/70 border border-border/50">
        {tool && (
          <div
            className={cn(
              'flex items-center gap-1.5 mb-1.5 text-xs italic',
              isSensitive ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {isSensitive ? (
              <ShieldAlert className="size-3 shrink-0" />
            ) : (
              <Wrench className="size-3 shrink-0" />
            )}
            <span>
              {isSensitive
                ? `${t(toolLabelKey(tool))} · ${t('aiSensitiveAction')}`
                : t(toolLabelKey(tool))}
            </span>
          </div>
        )}
        {stream.content ? (
          <p className="whitespace-pre-wrap leading-relaxed">
            {stream.content}
            <span className="ml-0.5 inline-block w-[2px] h-[1.05em] translate-y-0.5 bg-primary/70 animate-pulse" />
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('aiThinking')}</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block size-1.5 rounded-full bg-primary/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        {stream.pendingActions.map((action) => (
          <AiActionCard key={action.id} action={action} conversationId={conversationId} />
        ))}
      </div>
    </div>
  )
}
