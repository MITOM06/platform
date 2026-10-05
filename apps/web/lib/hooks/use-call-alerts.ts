'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useCallStore } from '@/lib/store/call.store'
import { useUser } from '@/lib/hooks/use-user'
import { useNickname } from '@/lib/nicknames'
import { callManager } from '@/lib/webrtc/call-manager'
import { endNoticeKey } from '@/lib/webrtc/call-end-notice'
import { showCallNotification } from '@/lib/webrtc/call-notification'
import { playTone, stopTone, toneFor } from '@/lib/webrtc/call-sounds'

/**
 * Everything a 1-on-1 call needs to get the user's attention and explain
 * itself: the caller's name (the offer only carries a userId), ringtone /
 * ringback, an OS notification while the tab is hidden, and a toast saying why
 * a call ended. Mounted once by CallOverlay.
 */
export function useCallAlerts(): void {
  const t = useTranslations('call')
  const status = useCallStore((s) => s.status)
  const peerId = useCallStore((s) => s.peerId)
  const conversationId = useCallStore((s) => s.conversationId)
  const peerName = useCallStore((s) => s.peerName)
  const video = useCallStore((s) => s.video)
  const incomingGroupRing = useCallStore((s) => s.incomingGroupCall !== null)

  const { data: peerUser } = useUser(peerId ?? undefined)
  const nickname = useNickname(conversationId ?? '', peerId ?? undefined)
  const resolvedName = nickname || peerUser?.displayName || ''

  // Name the caller as soon as it resolves (never show a raw userId).
  useEffect(() => {
    if (status !== 'idle' && !peerName && resolvedName) {
      useCallStore.getState().setPeerName(resolvedName)
    }
  }, [status, peerName, resolvedName])

  // Ringtone for the callee, ringback for the caller; silence otherwise.
  const tone = toneFor(status, incomingGroupRing)
  useEffect(() => {
    if (tone) playTone(tone)
    else stopTone()
  }, [tone])
  useEffect(() => () => stopTone(), [])

  // Background tab: an OS notification so the ring is not missed.
  useEffect(() => {
    if (status !== 'incoming') return
    const close = showCallNotification(
      video ? t('incomingVideo') : t('incomingVoice'),
      resolvedName || t('peerFallback'),
    )
    return () => close?.()
  }, [status, video, resolvedName, t])

  // Explain why a call closed (declined, busy, no answer, connection lost…).
  useEffect(() => {
    callManager.onEndNotice = (reason, byPeer, name) => {
      const key = endNoticeKey(reason, byPeer)
      if (!key) return
      const message = t(key, { name: name || t('peerFallback') })
      if (key === 'connectionLost' || key === 'mediaError') toast.error(message)
      else toast(message)
    }
    return () => {
      callManager.onEndNotice = null
    }
  }, [t])
}
