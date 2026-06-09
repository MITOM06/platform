'use client'

import { useQuery } from '@tanstack/react-query'
import { Brain, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { chatService } from '@/lib/api/chat'

interface Props {
  messageId: string | null
  onClose: () => void
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
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

export function AiTraceModal({ messageId, onClose }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-trace', messageId],
    queryFn: () => chatService.getTrace(messageId!),
    enabled: !!messageId,
    staleTime: Infinity,
  })

  return (
    <Dialog open={!!messageId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            AI Reasoning Trace
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive py-4 text-center">
            Không có trace cho tin nhắn này.
          </p>
        )}

        {data && (
          <div className="space-y-3 mt-2">
            <div className="flex gap-4 text-sm">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-muted-foreground">Input tokens</span>
                <span className="font-semibold">{data.inputTokens}</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-muted-foreground">Output tokens</span>
                <span className="font-semibold">{data.outputTokens}</span>
              </div>
            </div>

            {data.thinkingBlocks && data.thinkingBlocks.length > 0 && (
              <Section title={`Thinking blocks (${data.thinkingBlocks.length})`}>
                {data.thinkingBlocks.map((block, i) => (
                  <pre key={i} className="whitespace-pre-wrap font-mono text-xs bg-muted rounded p-2">
                    {block}
                  </pre>
                ))}
              </Section>
            )}

            {data.toolCalls && data.toolCalls.length > 0 && (
              <Section title={`Tool calls (${data.toolCalls.length})`}>
                {data.toolCalls.map((tc, i) => (
                  <div key={i} className="space-y-1">
                    <p className="font-medium">{tc.name}</p>
                    <pre className="whitespace-pre-wrap font-mono text-xs bg-muted rounded p-2">
                      {JSON.stringify(tc.input, null, 2)}
                    </pre>
                  </div>
                ))}
              </Section>
            )}

            {data.ragSources && data.ragSources.length > 0 && (
              <Section title={`RAG sources (${data.ragSources.length})`}>
                {data.ragSources.map((src, i) => (
                  <div key={i} className="border-l-2 pl-2 border-primary/40">
                    <p className="text-xs font-medium">Score: {src.score.toFixed(3)}</p>
                    <p className="italic">{src.excerpt}</p>
                  </div>
                ))}
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
