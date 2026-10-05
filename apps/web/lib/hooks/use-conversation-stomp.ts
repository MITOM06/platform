'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stompService } from '@/lib/stomp/client'
import { useStompConnected } from '@/lib/stomp/use-stomp-connected'
import { chatService } from '@/lib/api/chat'
import { useMessageCache } from '@/lib/hooks/use-message-cache'
import { useAiStreams } from '@/lib/hooks/use-ai-streams'
import { aiStreamErrorKey, type AiStreamEntry } from '@/lib/ai/stream-routing'
import { useCallStore } from '@/lib/store/call.store'
import { applyNicknameSystemMessage } from '@/lib/nicknames'
import { applyQuickReactionSystemMessage } from '@/lib/quick-reaction'
import { isMessageFrame, isStompEvent } from '@/lib/realtime/message-frames'
import { applySharedConversationUpdate } from '@/lib/realtime/conversation-cache'
import type { AiSource, CallEvent, CallMedia, Message } from '@/lib/api/types'

// Group-call lifecycle events (Track A §3) are keyed by `event`, not `type`.
const CALL_EVENT_TYPES = new Set(['call.started', 'call.roster', 'call.ended'])
function isCallEvent(parsed: Record<string, unknown>): parsed is CallEvent {
  return typeof parsed.event === 'string' && CALL_EVENT_TYPES.has(parsed.event)
}

export interface ActiveCall {
  callId: string
  media: CallMedia
  aiNotetaker: boolean
  joinedCount: number
}

interface UseConversationStompArgs {
  id: string
  messages: Message[]
  currentUserId?: string
}

interface UseConversationStompResult {
  typingUserIds: string[]
  /** Live AI reply bubbles, one per reply (routed by `replyId`). */
  aiStreams: AiStreamEntry[]
  activeCall: ActiveCall | null
  /** Show the "thinking" bubble for a message I just sent that triggers the AI. */
  startLocalAiStream: () => void
  /** The send failed — drop that bubble. */
  dropLocalAiStream: () => void
}

/**
 * Real-time wiring for a conversation thread: STOMP subscriptions for messages,
 * events and typing; the AI streaming state + watchdog; group-call lifecycle;
 * and per-message read receipts. STOMP events patch the TanStack Query cache
 * (via useMessageCache) instead of refetching (per web rules).
 */
export function useConversationStomp({
  id,
  messages,
  currentUserId,
}: UseConversationStompArgs): UseConversationStompResult {
  const t = useTranslations('chat')
  const router = useRouter()
  const queryClient = useQueryClient()
  // Re-run the STOMP subscribe effect on every (re)connect so a dropped socket
  // is re-subscribed instead of leaving a subscription bound to a dead socket.
  const stompConnected = useStompConnected()

  const [typingUserIds, setTypingUserIds] = useState<string[]>([])
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  // One bubble per AI reply, each with its own 30s watchdog (parity with Flutter).
  const ai = useAiStreams(id, currentUserId)
  const aiRef = useRef(ai)
  useEffect(() => {
    aiRef.current = ai
  })

  // Mirror of `messages` for stale-closure-free reads inside the STOMP effect
  // (which only depends on [id, stompConnected]). Used by the reconnect catch-up.
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  })

  const cache = useMessageCache(id)

  // Store message-cache callbacks in a ref so the STOMP subscription effect
  // only needs [id, stompConnected] in its dep array. The ref always holds the
  // latest version of each callback so stale-closure bugs are impossible.
  const msgCallbacksRef = useRef(cache)
  useEffect(() => {
    msgCallbacksRef.current = cache
  })

  // Removed from this conversation (kicked / left on another device): the chat is
  // already dropped from the caches — leave the screen instead of a dead thread.
  const leaveConversation = useCallback(() => {
    // Same toast id as the user-queue path, so both channels show one toast.
    toast.info(t('removedFromConversation'), { id: `removed-${id}` })
    router.replace('/conversations')
  }, [id, router, t])

  // RAG sources from an AI_STREAM_DONE that arrived before the persisted AI
  // message was in the cache — applied to that message on append (rare race).
  // Keyed by replyId ('' for servers that send none).
  const pendingAiSourcesRef = useRef(new Map<string, AiSource[]>())

  // Subscribe to STOMP for real-time messages + events + typing
  useEffect(() => {
    if (!stompConnected) return
    let active = true
    let typingSub: ReturnType<typeof stompService.subscribe>
    let messageSub: ReturnType<typeof stompService.subscribe>

    stompService.waitForConnect().then(() => {
      if (!active) return

      messageSub = stompService.subscribe(`/topic/conversation/${id}`, (frame) => {
        try {
          const parsed = JSON.parse(frame.body) as Record<string, unknown>

          if (isStompEvent(parsed)) {
            switch (parsed.type) {
              case 'MESSAGE_UPDATED': {
                // Patch only what the event carries: a pending-action status
                // update has no `editedAt` (and must not mark the message edited).
                const patch: Partial<Message> = {}
                if (typeof parsed.content === 'string') patch.content = parsed.content
                if (typeof parsed.editedAt === 'string') patch.editedAt = parsed.editedAt
                if (Array.isArray(parsed.pendingActions)) patch.pendingActions = parsed.pendingActions
                msgCallbacksRef.current.patchMessage(parsed.messageId, patch)
                break
              }
              case 'MESSAGE_RECALLED':
                msgCallbacksRef.current.recallMessage(parsed.messageId)
                break
              case 'MESSAGE_READ':
                msgCallbacksRef.current.markMessageRead(parsed.messageId, parsed.readerId)
                break
              case 'REACTION_UPDATED':
                msgCallbacksRef.current.patchMessage(parsed.messageId, { reactions: parsed.reactions })
                break
              case 'PINNED_MESSAGE':
                queryClient.invalidateQueries({ queryKey: ['conversation', id] })
                break
              case 'CONVERSATION_UPDATED':
                // Shared fields only (never my unread / mute / archive state):
                // MERGE into the cached copies instead of replacing them.
                if (
                  applySharedConversationUpdate(queryClient, parsed.conversation, currentUserId) ===
                  'removed'
                ) {
                  leaveConversation()
                }
                break
              case 'KB_STATUS_UPDATE':
                queryClient.invalidateQueries({ queryKey: ['kb-documents', id] })
                break
              case 'AI_ACTION_PENDING':
              case 'AI_STREAM_CHUNK':
              case 'AI_TOOL_CALL':
                // Routed to the bubble of that reply (replyId), never a shared one.
                aiRef.current.handleEvent(parsed)
                break
              case 'AI_STREAM_DONE': {
                aiRef.current.handleEvent(parsed)
                // Attach RAG citation sources to the persisted AI message so the
                // bubble can render clickable chips. The saved message frame is
                // sent before this DONE frame (same topic, FIFO), so it is
                // normally already in the cache; if not (rare reorder), stash the
                // sources for the next AI message append.
                const doneSources = parsed.sources ?? []
                if (
                  doneSources.length > 0 &&
                  !msgCallbacksRef.current.attachAiSources(doneSources, parsed.replyId)
                ) {
                  pendingAiSourcesRef.current.set(parsed.replyId ?? '', doneSources)
                }
                break
              }
              case 'AI_STREAM_ERROR': {
                // Only the member who asked gets the toast; everyone else just
                // sees that reply's bubble end. Mapped, localized text only —
                // never the raw backend error string.
                if (aiRef.current.handleEvent(parsed)) {
                  toast.error(t(aiStreamErrorKey(parsed.code)))
                }
                break
              }
            }
          } else if (isCallEvent(parsed)) {
            // Group-call lifecycle (Track A §3): drive the active-call banner and,
            // if this client is in the call, feed the roster into the mesh manager.
            switch (parsed.event) {
              case 'call.started': {
                setActiveCall({
                  callId: parsed.callId,
                  media: parsed.media,
                  aiNotetaker: parsed.aiNotetaker,
                  joinedCount: parsed.participants.length,
                })
                // If WE started it, the server already added us as a participant —
                // activate our group-call state without re-joining.
                if (parsed.startedBy === currentUserId) {
                  void import('@/lib/webrtc/group-call-manager').then((m) =>
                    m.groupCallManager.confirmStarted(
                      parsed.callId,
                      parsed.conversationId,
                      currentUserId!,
                      parsed.media,
                      parsed.aiNotetaker,
                    ),
                  )
                }
                break
              }
              case 'call.roster': {
                const joined = parsed.participants.filter((p) => !p.leftAt).length
                setActiveCall((prev) =>
                  prev && prev.callId === parsed.callId ? { ...prev, joinedCount: joined } : prev,
                )
                if (useCallStore.getState().groupCallId === parsed.callId) {
                  void import('@/lib/webrtc/group-call-manager').then((m) =>
                    m.groupCallManager.applyRoster(parsed.participants),
                  )
                }
                break
              }
              case 'call.ended':
                setActiveCall((prev) => (prev?.callId === parsed.callId ? null : prev))
                void import('@/lib/webrtc/group-call-manager').then((m) =>
                  m.groupCallManager.handleEnded(parsed.callId),
                )
                break
            }
          } else if (isMessageFrame(parsed, id)) {
            // Regular message (includes AI final message after AI_STREAM_DONE).
            // Anything else (an unknown event type, a malformed frame) is ignored —
            // rendering it as a bubble used to crash the whole chat screen.
            const msg: Message = parsed
            if (msg.type === 'system') {
              applyNicknameSystemMessage(id, msg.content)
              applyQuickReactionSystemMessage(id, msg.content)
            }
            if (msg.type === 'ai') {
              // If a DONE frame delivered sources before this AI message arrived
              // (rare reorder), graft them on so the chips render.
              const stashKey = msg.aiReplyId && pendingAiSourcesRef.current.has(msg.aiReplyId)
                ? msg.aiReplyId
                : pendingAiSourcesRef.current.has('') ? '' : undefined
              if (stashKey !== undefined) {
                msg.sources = pendingAiSourcesRef.current.get(stashKey)
                pendingAiSourcesRef.current.delete(stashKey)
              }
            }
            msgCallbacksRef.current.appendMessage(msg)
            // The saved reply replaces exactly its own streaming bubble.
            if (msg.type === 'ai' && msg.aiReplyId) aiRef.current.finishReply(msg.aiReplyId)
          }
        } catch {
          // ignore malformed frames
        }
      })

      typingSub = stompService.subscribe(
        `/topic/conversation/${id}/typing`,
        (frame) => {
          try {
            const { userId, typing } = JSON.parse(frame.body) as { userId: string; typing: boolean }
            if (userId === currentUserId) return
            setTypingUserIds((prev) =>
              typing ? [...new Set([...prev, userId])] : prev.filter((uid) => uid !== userId),
            )
          } catch {
            // ignore
          }
        },
      )

      // Catch-up (parity with Flutter chat_provider._catchupMessages, Task 55).
      // We subscribe first (above) so no live message is missed, then:
      //  1. backfill EVERY message newer than the newest one we hold — the
      //     catch-up endpoint pages 50 at a time, so loop on hasNext + afterId;
      //  2. re-fetch the latest page so edits / recalls / reactions made while
      //     the socket was down replace the stale cached copies.
      // `messages` are chronological (oldest → newest): the last is the freshest.
      const newest = messagesRef.current[messagesRef.current.length - 1]
      if (newest?.createdAt) {
        Promise.all([
          chatService.getAllMessagesSince(id, newest.createdAt, newest.id),
          chatService.getMessages(id).then((page) => page.content),
        ])
          .then(([missed, latest]) => {
            if (!active) return
            msgCallbacksRef.current.reconcileMessages([...latest, ...missed])
          })
          .catch(() => {
            // Best-effort: a failed catch-up is non-fatal; scrolling/refetch recovers.
          })
      }
    }).catch(() => {
      // Connection failed — cleanup will handle retry via stompConnected changing
    })

    return () => {
      active = false
      messageSub?.unsubscribe()
      typingSub?.unsubscribe()
    }
  }, [id, stompConnected, queryClient, currentUserId, t, leaveConversation])

  // Mark conversation as read on open
  useEffect(() => {
    chatService.markConversationRead(id).catch(() => {})
  }, [id])

  // Per-message read receipts (parity with mobile _markLoadedAsRead): publish
  // /app/chat.read for messages from others so the sender's seen-tick flips on
  // in realtime. The server persists readBy + broadcasts MESSAGE_READ.
  const sentReadRef = useRef<Set<string>>(new Set())

  // Reset the sent-read set when switching conversations so we don't carry
  // over IDs from a previous thread into the new one.
  useEffect(() => {
    sentReadRef.current = new Set()
  }, [id])

  useEffect(() => {
    if (!currentUserId) return
    const sent = sentReadRef.current
    stompService.waitForConnect().then(() => {
      for (const m of messages) {
        if (
          m.senderId !== currentUserId &&
          !sent.has(m.id) &&
          !(m.readBy ?? []).includes(currentUserId)
        ) {
          sent.add(m.id)
          stompService.publish('/app/chat.read', { conversationId: id, messageId: m.id })
        }
      }
    }).catch(() => {
      // Socket never connected — read receipts will be resent on reconnect
      // when this effect re-runs. Swallow to avoid an unhandled rejection.
    })
  }, [id, messages, currentUserId])

  return {
    typingUserIds,
    aiStreams: ai.streams,
    activeCall,
    startLocalAiStream: ai.startLocal,
    dropLocalAiStream: ai.dropLocal,
  }
}
