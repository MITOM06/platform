'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Brain,
  Loader2,
  Trash2,
  MessageSquare,
  Calendar,
  Lightbulb,
  AlertCircle,
} from 'lucide-react'
import { aiService, type AiMemory } from '@/lib/api/ai'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// ── Memory Card ──────────────────────────────────────────────────────────────

function MemoryCard({
  memory,
  onDelete,
  usageCountLabel,
}: {
  memory: AiMemory
  onDelete: () => void
  usageCountLabel: string
}) {
  const date = new Date(memory.updatedAt)
  const dateStr = date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="group rounded-xl border bg-card p-4 transition-all hover:shadow-lg hover:border-[#B47FFF]/30 relative overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl bg-gradient-to-r from-[#B47FFF]/[0.03] to-transparent" />

      <div className="relative flex gap-3">
        {/* Icon */}
        <div className="size-11 rounded-xl bg-[#2D1B69] flex items-center justify-center shrink-0">
          <Brain className="size-5 text-[#B47FFF]" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
            {memory.summary || '…'}
          </p>

          {memory.keyFacts.length > 0 && (
            <div className="mt-2.5">
              <p className="text-[11px] font-semibold text-[#B47FFF]/80 mb-1 flex items-center gap-1">
                <Lightbulb className="size-3" />
                {usageCountLabel}
              </p>
              {memory.keyFacts.slice(0, 3).map((fact, i) => (
                <p
                  key={i}
                  className="text-xs text-muted-foreground/70 leading-relaxed"
                >
                  • {fact}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3">
            {/* Turn count badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border border-[#B47FFF]/20 bg-[#B47FFF]/10 text-[#B47FFF]/90">
              <MessageSquare className="size-2.5" />
              {memory.messageCount}
            </span>

            <span className="flex-1" />

            {/* Date */}
            <span className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
              <Calendar className="size-2.5" />
              {dateStr}
            </span>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="size-8 rounded-lg flex items-center justify-center shrink-0 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ empty, emptyHint }: { empty: string; emptyHint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Brain className="size-20 text-muted-foreground/15" />
      <div className="text-center space-y-1.5">
        <p className="text-sm text-muted-foreground/50">
          {empty}
        </p>
        <p className="text-xs text-muted-foreground/30 max-w-[280px]">
          {emptyHint}
        </p>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AiContextPage() {
  const t = useTranslations('aiContext')
  const tc = useTranslations('common')
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: memory, isLoading, error } = useQuery({
    queryKey: ['ai-memory'],
    queryFn: () => aiService.getMyMemories(),
  })

  // P2b: getMyMemories now returns a single aggregate. Task 4 replaces this page
  // with the 4-section AI Context layout; this keeps the interim page compiling.
  const memories: AiMemory[] = memory && (memory.summary || memory.keyFacts.length > 0) ? [memory] : []

  const deleteMutation = useMutation({
    mutationFn: (conversationId: string) => aiService.deleteMemory(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-memory'] })
      toast.success(t('deleteSuccess'))
      setDeleteTarget(null)
    },
    onError: () => toast.error(t('deleteError')),
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
        {memories && memories.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground/50 tabular-nums">
            {t('headerCount', { count: memories.length })}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Background glows */}
        <div className="relative min-h-full">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#B47FFF]/5 blur-3xl pointer-events-none dark:bg-[#B47FFF]/8" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-pon-cyan/5 blur-3xl pointer-events-none dark:bg-pon-cyan/8" />

          <div className="relative max-w-lg mx-auto px-6 py-6">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="size-8 animate-spin text-[#B47FFF]" />
                <p className="text-sm text-muted-foreground">{t('loading')}</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <AlertCircle className="size-10 text-destructive/50" />
                <p className="text-sm text-destructive">{t('loadError')}</p>
              </div>
            )}

            {memories && memories.length === 0 && (
              <EmptyState empty={t('empty')} emptyHint={t('emptyHint')} />
            )}

            {memories && memories.length > 0 && (
              <div className="space-y-3">
                {memories.map((m) => (
                  <MemoryCard
                    key={m.conversationId ?? 'me'}
                    memory={m}
                    onDelete={() => m.conversationId && setDeleteTarget(m.conversationId)}
                    usageCountLabel={t('keyInfo')}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
