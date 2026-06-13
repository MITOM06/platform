'use client'

import { useEffect, useState } from 'react'

// Conversation nicknames are stored client-side (mirrors Flutter's
// shared_preferences `chat_nicknames_<convId>`) and synced across participants
// via `system.nickname.changed:<userId>:<nickname>` system messages. No backend
// field is involved — same pattern as chat wallpapers.

const NICKNAME_PREFIX = 'system.nickname.changed:'
export const NICKNAME_EVENT = 'nickname-changed'

const key = (convId: string) => `chat_nicknames_${convId}`

export function getNicknames(convId: string): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(key(convId)) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function getNickname(convId: string, userId: string): string | undefined {
  return getNicknames(convId)[userId]
}

function writeNickname(convId: string, userId: string, nickname: string) {
  const map = getNicknames(convId)
  if (nickname.trim()) map[userId] = nickname.trim()
  else delete map[userId]
  localStorage.setItem(key(convId), JSON.stringify(map))
  window.dispatchEvent(new Event(NICKNAME_EVENT))
}

/** Set locally (the caller is responsible for broadcasting the system message). */
export function setNickname(convId: string, userId: string, nickname: string) {
  writeNickname(convId, userId, nickname)
}

/** Build the system-message payload broadcast to all participants. */
export function nicknameSystemMessage(userId: string, nickname: string): string {
  return `${NICKNAME_PREFIX}${userId}:${nickname}`
}

/** Apply an incoming/historical `system.nickname.changed:` system message. */
export function applyNicknameSystemMessage(convId: string, content: string): void {
  if (!content.startsWith(NICKNAME_PREFIX)) return
  const rest = content.slice(NICKNAME_PREFIX.length)
  const idx = rest.indexOf(':')
  if (idx === -1) return
  writeNickname(convId, rest.slice(0, idx), rest.slice(idx + 1))
}

/** Reactive read of a single user's nickname within a conversation. */
export function useNickname(convId: string, userId?: string): string | undefined {
  const [nick, setNick] = useState<string | undefined>(undefined)
  useEffect(() => {
    const update = () => setNick(userId ? getNickname(convId, userId) : undefined)
    update()
    window.addEventListener(NICKNAME_EVENT, update)
    return () => window.removeEventListener(NICKNAME_EVENT, update)
  }, [convId, userId])
  return nick
}
