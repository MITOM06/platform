'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { AiThreadItem } from '@/components/ai/AiThreadItem'
import { chatService } from '@/lib/api/chat'
import { parseChatError } from '@/lib/api/chat-errors'
import { useAiThreads, useCreateAiThread, useRenameAiThread } from '@/lib/hooks/use-ai-threads'
import { dropConversation } from '@/lib/realtime/conversation-cache'
import type { Conversation } from '@/lib/api/types'

/**
 * ChatGPT-style sidebar: every AI "new chat" is its own conversation. Replaces the
 * normal conversation list while an AI thread (or the AI hub) is open.
 */
export function AiThreadList() {
  const t = useTranslations('aiThreads')
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { data: threads, isLoading, isError } = useAiThreads()
  const create = useCreateAiThread()
  const rename = useRenameAiThread()
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null)

  const openId = /^\/conversations\/([^/]+)/.exec(pathname)?.[1]

  const handleCreate = async () => {
    try {
      const conv = await create.mutateAsync()
      router.push(`/conversations/${conv.id}`)
    } catch {
      toast.error(t('createFailed'))
    }
  }

  const handleRename = async (id: string, name: string): Promise<boolean> => {
    try {
      await rename.mutateAsync({ id, name })
      return true
    } catch (err) {
      toast.error(parseChatError(err).code === 'AI_THREAD_NAME_INVALID' ? t('nameInvalid') : t('renameFailed'))
      return false
    }
  }

  const handleConfirmDelete = async () => {
    const target = pendingDelete
    if (!target) return
    setPendingDelete(null)
    const list = threads ?? []
    const idx = list.findIndex((c) => c.id === target.id)
    const next = list[idx + 1] ?? list[idx - 1]
    try {
      await chatService.deleteConversation(target.id)
      // Navigate away BEFORE dropping caches: the layout and conversation page still observe
      // the open id, so dropping first flashes the normal list / refetches a deleted id (404).
      // replace (not push) so Back never returns to the deleted thread.
      if (openId === target.id) router.replace(next ? `/conversations/${next.id}` : '/ai-hub')
      dropConversation(queryClient, target.id)
    } catch {
      toast.error(t('deleteFailed'))
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-1 px-2 pt-2 pb-1">
        <Link
          href="/conversations"
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="truncate">{t('backToMessages')}</span>
        </Link>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={create.isPending}
          className="flex w-full items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/70 disabled:opacity-60"
        >
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          <span className="truncate">{t('newThread')}</span>
        </button>
      </div>

      <nav aria-label={t('listLabel')} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
        {isLoading && (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}
        {isError && <p className="px-2 py-4 text-sm text-muted-foreground">{t('loadFailed')}</p>}
        {!isLoading && !isError && (threads?.length ?? 0) === 0 && (
          <p className="px-2 py-4 text-sm text-muted-foreground">{t('empty')}</p>
        )}
        {threads?.map((thread) => (
          <AiThreadItem
            key={thread.id}
            thread={thread}
            active={thread.id === openId}
            onRename={handleRename}
            onDelete={setPendingDelete}
          />
        ))}
      </nav>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={t('deleteTitle')}
        description={t('deleteDesc')}
        confirmLabel={t('delete')}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  )
}
