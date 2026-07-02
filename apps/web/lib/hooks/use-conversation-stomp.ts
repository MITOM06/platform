'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stompService } from '@/lib/stomp/client'
import { useStompConnected } from '@/lib/stomp/use-stomp-connected'
import { chatService } from '@/lib/api/chat'
import { useMessageCache } from '@/lib/hooks/use-message-cache'
import { useCallStore } from '@/lib/store/call.store'
import { applyNicknameSystemMessage } from '@/lib/nicknames'
import { applyQuickReactionSystemMessage } from '@/lib/quick-reaction'
import type {
  AiSource,
  AiStreamState,
  CallEvent,
  CallMedia,
  Message,
  StompEvent,
} from '@/lib/api/types'

// STOMP events use UPPER_CASE types; regular messages use lowercase types
const STOMP_EVENT_TYPES = new Set([
  'MESSAGE_UPDATED', 'MESSAGE_RECALLED', 'MESSAGE_READ', 'REACTION_UPDATED',
  'PINNED_MESSAGE', 'CONVERSATION_UPDATED',
  'AI_STREAM_CHUNK', 'AI_STREAM_DONE', 'AI_STREAM_ERROR', 'AI_TOOL_CALL',
])

function isStompEvent(parsed: Record<string, unknown>): parsed is StompEvent {
  return typeof parsed.type === 'string' && STOMP_EVENT_TYPES.has(parsed.type)
}

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
  aiStream: AiStreamState | null
  setAiStream: React.Dispatch<React.SetStateAction<AiStreamState | null>>
  activeCall: ActiveCall | null
  armAiWatchdog: () => void
  clearAiStream: () => void
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
  const queryClient = useQueryClient()
  // Re-run the STOMP subscribe effect on every (re)connect so a dropped socket
  // is re-subscribed instead of leaving a subscription bound to a dead socket.
  const stompConnected = useStompConnected()

  const [typingUserIds, setTypingUserIds] = useState<string[]>([])
  const [aiStream, setAiStream] = useState<AiStreamState | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  // Watchdog so a "thinking" bubble never sticks forever if the AI never
  // responds (parity with Flutter's 30s watchdog). Re-armed on every AI event.
  const aiWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mirror of `messages` for stale-closure-free reads inside the STOMP effect
  // (which only depends on [id, stompConnected]). Used by the reconnect catch-up.
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  })

  const { patchMessage, markMessageRead, appendMessage, attachAiSources } = useMessageCache(id)

  // Store message-cache callbacks in a ref so the STOMP subscription effect
  // only needs [id, stompConnected] in its dep array. The ref always holds the
  // latest version of each callback so stale-closure bugs are impossible.
  const msgCallbacksRef = useRef({ patchMessage, markMessageRead, appendMessage, attachAiSources })
  useEffect(() => {
    msgCallbacksRef.current = { patchMessage, markMessageRead, appendMessage, attachAiSources }
  })

  // RAG sources from an AI_STREAM_DONE that arrived before the persisted AI
  // message was in the cache — applied to that message on append (rare race).
  const pendingAiSourcesRef = useRef<AiSource[] | null>(null)

  const armAiWatchdog = useCallback(() => {
    if (aiWatchdogRef.current) clearTimeout(aiWatchdogRef.current)
    aiWatchdogRef.current = setTimeout(() => setAiStream(null), 30000)
  }, [])

  const clearAiStream = useCallback(() => {
    if (aiWatchdogRef.current) {
      clearTimeout(aiWatchdogRef.current)
      aiWatchdogRef.current = null
    }
    setAiStream(null)
  }, [])

  // Clear the watchdog timer on unmount.
  useEffect(() => () => {
    if (aiWatchdogRef.current) clearTimeout(aiWatchdogRef.current)
  }, [])

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
              case 'MESSAGE_UPDATED':
                msgCallbacksRef.current.patchMessage(parsed.messageId, {
                  content: parsed.content,
                  editedAt: parsed.editedAt,
                })
                break
              case 'MESSAGE_RECALLED':
                msgCallbacksRef.current.patchMessage(parsed.messageId, { recalled: true })
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
                queryClient.setQueryData(['conversation', id], parsed.conversation)
                queryClient.invalidateQueries({ queryKey: ['conversations'] })
                // A participant may have changed their avatar/displayName — refresh
                // their cached profile so peers see the new avatar (issue 1). The
                // refetched URL is unique-per-upload so it dodges the HTTP cache.
                parsed.conversation.participants.forEach((uid) =>
                  queryClient.invalidateQueries({ queryKey: ['user', uid] }),
                )
                break
              case 'AI_STREAM_CHUNK':
                setAiStream((prev) => ({
                  content: (prev?.content ?? '') + String(parsed.chunk ?? ''),
                  thinking: false,
                  activeTools: prev?.activeTools ?? [],
                  sensitiveTools: prev?.sensitiveTools ?? [],
                }))
                armAiWatchdog()
                break
              case 'AI_TOOL_CALL': {
                const toolName = String(parsed.toolName ?? '')
                const isSensitive = parsed.sensitive === true
                setAiStream((prev) => {
                  const base = prev ?? { content: '', thinking: true, activeTools: [], sensitiveTools: [] }
                  return {
                    ...base,
                    activeTools: base.activeTools.includes(toolName)
                      ? base.activeTools
                      : [...base.activeTools, toolName],
                    sensitiveTools:
                      isSensitive && !base.sensitiveTools.includes(toolName)
                        ? [...base.sensitiveTools, toolName]
                        : base.sensitiveTools,
                  }
                })
                armAiWatchdog()
                break
              }
              case 'AI_STREAM_DONE': {
                clearAiStream()
                // Attach RAG citation sources to the persisted AI message so the
                // bubble can render clickable chips. The saved message frame is
                // sent before this DONE frame (same topic, FIFO), so it is
                // normally already in the cache; if not (rare reorder), stash the
                // sources for the next AI message append.
                const doneSources = parsed.sources ?? []
                if (doneSources.length > 0 && !msgCallbacksRef.current.attachAiSources(doneSources)) {
                  pendingAiSourcesRef.current = doneSources
                }
                break
              }
              case 'AI_STREAM_ERROR': {
                clearAiStream()
                const aiErrCodeMap: Record<string, string> = {
                  AI_QUOTA_EXCEEDED: t('aiQuotaExceeded'),
                  AI_RATE_LIMITED: t('aiRateLimited'),
                  AI_STREAM_INTERRUPTED: t('aiStreamInterrupted'),
                  AI_UNAVAILABLE: t('aiUnavailable'),
                }
                // Only show a mapped, localized message — never the raw backend
                // error string, which is internal/system text.
                const aiErrMsg = parsed.code && aiErrCodeMap[parsed.code]
                  ? aiErrCodeMap[parsed.code]
                  : t('aiError')
                toast.error(aiErrMsg)
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
          } else {
            // Regular message (includes AI final message after AI_STREAM_DONE)
            const msg = parsed as unknown as Message
            if (msg.type === 'system' && typeof msg.content === 'string') {
              applyNicknameSystemMessage(id, msg.content)
              applyQuickReactionSystemMessage(id, msg.content)
            }
            // If a DONE frame delivered sources before this AI message arrived
            // (rare reorder), graft them on so the chips render.
            if (msg.type === 'ai' && pendingAiSourcesRef.current) {
              msg.sources = pendingAiSourcesRef.current
              pendingAiSourcesRef.current = null
            }
            msgCallbacksRef.current.appendMessage(msg)
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

      // Catch-up: pull in messages that arrived while the socket was down (parity
      // with Flutter chat_provider._catchupMessages, Task 55). We subscribe first
      // (above) so no live message is missed, then backfill the gap from the
      // newest message we already hold. `messages` are chronological (oldest →
      // newest), so the last entry is the freshest. appendMessage de-dupes by id.
      const newest = messagesRef.current[messagesRef.current.length - 1]
      if (newest?.createdAt) {
        chatService
          .getMessagesSince(id, newest.createdAt)
          .then((missed) => {
            if (!active) return
            for (const m of missed) msgCallbacksRef.current.appendMessage(m)
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
  }, [id, stompConnected, queryClient, currentUserId, t, armAiWatchdog, clearAiStream])

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

  return { typingUserIds, aiStream, setAiStream, activeCall, armAiWatchdog, clearAiStream }
}
