'use client'

import { useQuery } from '@tanstack/react-query'
import { Brain, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Badge } from '@/components/ui/badge'
import { chatService } from '@/lib/api/chat'
import { useProviderNameSources } from '@/lib/hooks/use-connectors'
import { toolDisplayLabel } from '@/lib/ai/connector-names'
import { modelDisplayName, toolCallStatus, type ToolCallStatus } from '@/lib/ai/trace'
import type { AiTraceResponse } from '@/lib/api/types'

interface Props {
  messageId: string | null
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-md">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50"
        onClick={() => setOpen((v) => !v)}
      >
        {title}
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {open && <div className="px-3 pb-3 text-xs text-muted-foreground space-y-1">{children}</div>}
    </div>
  )
}

const STATUS_KEYS: Record<ToolCallStatus, string> = {
  done: 'aiTraceToolDone',
  failed: 'aiTraceToolFailed',
  awaiting: 'aiTraceToolAwaiting',
  skipped: 'aiTraceToolSkipped',
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** Token / timing summary of a reply — cache reads and writes are part of the input. */
function TraceStats({ data }: { data: AiTraceResponse }) {
  const t = useTranslations('chat')
  const locale = useLocale()
  const num = new Intl.NumberFormat(locale)
  const stats: Array<{ label: string; value: string }> = [
    { label: t('aiTraceInputTokens'), value: num.format(data.inputTokens ?? 0) },
    { label: t('aiTraceOutputTokens'), value: num.format(data.outputTokens ?? 0) },
  ]
  if (data.cachedInputTokens) {
    stats.push({ label: t('aiTraceCacheReadTokens'), value: num.format(data.cachedInputTokens) })
  }
  if (data.cacheCreationInputTokens) {
    stats.push({
      label: t('aiTraceCacheWriteTokens'),
      value: num.format(data.cacheCreationInputTokens),
    })
  }
  if (data.thinkingTokens) {
    stats.push({ label: t('aiTraceThinkingTokens'), value: num.format(data.thinkingTokens) })
  }
  if (data.processingMs) {
    stats.push({
      label: t('aiTraceDuration'),
      value: new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'second',
        unitDisplay: 'short',
        maximumFractionDigits: 1,
      }).format(data.processingMs / 1000),
    })
  }
  if (data.iterationCount) {
    stats.push({ label: t('aiTraceIterations'), value: num.format(data.iterationCount) })
  }
  const model = modelDisplayName(data.model)
  return (
    <div className="space-y-2">
      {model && (
        <p className="text-xs text-muted-foreground">{t('aiTraceModel', { model })}</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} />
        ))}
      </div>
    </div>
  )
}

/**
 * Agent Trace: how the AI produced a reply — model, tokens (incl. prompt-cache
 * reads/writes), timing, reasoning and the tools it used. Tool calls show the
 * tool's display name and outcome only: `inputSummary` / `resultSummary` are raw
 * tool payloads (an email body, a document) and are never rendered.
 */
export function AiTraceModal({ messageId, onClose }: Props) {
  const t = useTranslations('chat')
  // Only fetched while the trace is open (the modal stays mounted with the chat).
  const providerSources = useProviderNameSources(!!messageId)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-trace', messageId],
    queryFn: () => chatService.getTrace(messageId!),
    enabled: !!messageId,
    staleTime: Infinity,
  })
  const toolCalls = data?.toolCalls ?? []

  return (
    <ResponsiveModal
      open={!!messageId}
      onOpenChange={(o) => !o && onClose()}
      desktopClassName="sm:max-w-lg"
      title={
        <span className="flex items-center gap-2">
          <Brain className="size-5 text-primary" />
          {t('aiTraceTitle')}
        </span>
      }
    >
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-muted-foreground py-4 text-center">{t('aiTraceEmpty')}</p>
      )}

      {data && (
        <div className="space-y-3 mt-2">
          <TraceStats data={data} />

          {data.thinkingBlocks && data.thinkingBlocks.length > 0 && (
            <Section title={t('aiTraceThinkingBlocks', { count: data.thinkingBlocks.length })}>
              {data.thinkingBlocks.map((block, i) => (
                <pre key={i} className="whitespace-pre-wrap font-mono text-xs bg-muted rounded p-2">
                  {block}
                </pre>
              ))}
            </Section>
          )}

          {toolCalls.length > 0 && (
            <Section title={t('aiTraceToolCalls', { count: toolCalls.length })}>
              <ul className="space-y-1.5">
                {toolCalls.map((tc, i) => {
                  const status = toolCallStatus(tc.resultSummary)
                  return (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground">
                        {toolDisplayLabel(tc.toolName, t, providerSources)}
                      </span>
                      <Badge variant={status === 'failed' ? 'destructive' : 'secondary'}>
                        {t(STATUS_KEYS[status])}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}
        </div>
      )}
    </ResponsiveModal>
  )
}
