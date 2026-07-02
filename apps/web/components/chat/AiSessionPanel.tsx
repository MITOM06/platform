'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCcw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useTranslations } from 'next-intl'
import { aiSessionApi, type AiSession } from '@/lib/api/ai-session'
import { Button } from '@/components/ui/button'
import {
  AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'

/**
 * Per-conversation AI session history. Lets the user see past sessions, resume
 * an older one, or start a fresh session (equivalent to sending `/new`).
 * Mirrors Flutter `ai_session_panel.dart`. AI conversations only.
 */
export function AiSessionPanel({ conversationId }: { conversationId: string }) {
  const t = useTranslations('chat')
  const qc = useQueryClient()

  const { data: sessions = [] } = useQuery<AiSession[]>({
    queryKey: ['ai-sessions', conversationId],
    queryFn: () => aiSessionApi.listSessions(conversationId),
  })

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['ai-sessions', conversationId] })

  const newSession = useMutation({
    mutationFn: () => aiSessionApi.createNew(conversationId),
    onSuccess: invalidate,
  })

  const resumeSession = useMutation({
    mutationFn: (sessionId: string) => aiSessionApi.resume(conversationId, sessionId),
    onSuccess: invalidate,
  })

  const busy = newSession.isPending || resumeSession.isPending

  return (
    <AccordionItem value="ai-sessions" className="border-none">
      <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-pon-cyan">
        <span className="font-semibold text-sm">{t('aiSessionHistory')}</span>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-1 space-y-3">
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full gap-1 text-xs"
          onClick={() => newSession.mutate()}
          disabled={busy}
        >
          <Plus className="size-3" />
          {t('aiNewSession')}
        </Button>

        <div className="space-y-1 max-h-64 overflow-y-auto">
          {sessions.map((s) => (
            <div
              key={s._id}
              role={s.isActive ? undefined : 'button'}
              tabIndex={s.isActive ? undefined : 0}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                s.isActive
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-muted/50 cursor-pointer'
              }`}
              onClick={() => !s.isActive && !busy && resumeSession.mutate(s._id)}
              onKeyDown={(e) => {
                if (!s.isActive && !busy && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  resumeSession.mutate(s._id)
                }
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}
                  {s.summary && ` · ${t('aiContextCompacted')}`}
                </p>
              </div>
              {s.isActive ? (
                <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded shrink-0">
                  {t('aiSessionActive')}
                </span>
              ) : (
                <RotateCcw className="size-3.5 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
