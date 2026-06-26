'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { MessageList } from '@/components/chat/MessageList'
import type { AiStreamState, Message } from '@/lib/api/types'

// Synchronous-before-paint on the client (so scroll jumps never flash), plain
// effect on the server to avoid React's SSR useLayoutEffect warning.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

interface Props {
  messages: Message[]
  currentUserId?: string
  conversationId: string
  otherUserId?: string
  pinnedMessages: string[]
  isGroup: boolean
  isLoading: boolean
  isError: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  typingUserIds: string[]
  assistantTyping?: boolean
  aiStream: AiStreamState | null
  onEdit: (message: Message) => void
  onForward: (message: Message) => void
  onReply: (message: Message) => void
  onAiTrace: (messageId: string) => void
  onOptimisticUpdate: (updated: Partial<Message> & { id: string }) => void
}

// How close to the bottom (px) the user must be for an incoming message to
// auto-scroll the viewport. Beyond this, we leave their scroll position alone
// so reading history isn't interrupted.
const FOLLOW_THRESHOLD_PX = 220

/**
 * Owns the scrolling message viewport and its pagination scroll model.
 *
 * This component is mounted with `key={conversationId}` by the page, so every
 * conversation switch tears it down and rebuilds it from a clean state —
 * equivalent to a full page reload, but automatic. That is the deliberate fix
 * for the previous virtualized list, which reused one scroll container across
 * switches and left long threads blank (stale offset + estimate/measure race)
 * until the user manually reloaded.
 *
 * Rendering is NOT virtualized: cursor pagination already bounds the DOM to the
 * newest ~30 messages plus whatever older pages the user scrolled up to load,
 * so `scrollHeight`-based positioning is exact and never races with async
 * measurement.
 */
export function MessageViewport(props: Props) {
  const { messages, hasNextPage, isFetchingNextPage, fetchNextPage, aiStream } = props

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  // scrollHeight captured right before an older page is prepended, used to
  // restore the user's reading position afterwards.
  const prevScrollHeightRef = useRef(0)
  const isPrependingRef = useRef(false)
  // True once we've performed the initial jump-to-bottom for this conversation.
  // Until then the top sentinel must NOT trigger an older-page fetch (on a long
  // thread the sentinel is in view at mount before we scroll down).
  const didInitialScrollRef = useRef(false)

  // Initial jump to the newest message, before paint, as soon as the first
  // batch is in the DOM. Runs once per conversation (component is keyed on id).
  useIsomorphicLayoutEffect(() => {
    if (didInitialScrollRef.current || messages.length === 0) return
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    didInitialScrollRef.current = true
  }, [messages.length])

  // Load older messages when the top sentinel scrolls into view. Guarded by
  // didInitialScrollRef so the very first mount doesn't fetch a page before the
  // initial jump-to-bottom has happened.
  useEffect(() => {
    const sentinel = topSentinelRef.current
    const el = scrollContainerRef.current
    if (!sentinel || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          didInitialScrollRef.current &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          prevScrollHeightRef.current = el.scrollHeight
          isPrependingRef.current = true
          fetchNextPage()
        }
      },
      { root: el, threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Restore scroll position after an older page is prepended so the viewport
  // doesn't jump. Exact because scrollHeight is a real measured value.
  useIsomorphicLayoutEffect(() => {
    if (!isPrependingRef.current || isFetchingNextPage) return
    const el = scrollContainerRef.current
    if (el && prevScrollHeightRef.current) {
      el.scrollTop = el.scrollHeight - prevScrollHeightRef.current
    }
    isPrependingRef.current = false
    prevScrollHeightRef.current = 0
  }, [messages.length, isFetchingNextPage])

  // Follow new messages / streaming AI output to the bottom, but only when the
  // user is already near the bottom — never yank them down while reading
  // history, and never fight the prepend restore above.
  useEffect(() => {
    if (isPrependingRef.current || !didInitialScrollRef.current) return
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < FOLLOW_THRESHOLD_PX) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length, aiStream])

  return (
    <div
      ref={scrollContainerRef}
      className="absolute inset-0 overflow-y-auto px-4 py-4 z-10"
    >
      <div ref={topSentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      <MessageList {...props} />
    </div>
  )
}
