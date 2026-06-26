'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Phone, PhoneOff, Video } from 'lucide-react'
import { useCallStore } from '@/lib/store/call.store'
import { callManager } from '@/lib/webrtc/call-manager'
import { Button } from '@/components/ui/button'
import { VoiceCallModal } from './VoiceCallModal'
import { VideoCallModal } from './VideoCallModal'
import { GroupCallModal } from './GroupCallModal'
import { IncomingGroupCall } from './IncomingGroupCall'

/**
 * Global call UI. Mounted once in the (main) layout. Renders nothing while
 * idle; otherwise shows the incoming prompt, or delegates the outgoing/
 * connected view to the audio-only [VoiceCallModal] or two-way [VideoCallModal]
 * depending on the call's `video` flag. Owns the duration timer so it ticks
 * regardless of which modal is mounted.
 */
export function CallOverlay() {
  const t = useTranslations('call')
  const status = useCallStore((s) => s.status)
  const peerName = useCallStore((s) => s.peerName)
  const video = useCallStore((s) => s.video)
  const setDuration = useCallStore((s) => s.setDuration)
  const groupCallId = useCallStore((s) => s.groupCallId)
  const incomingGroupCall = useCallStore((s) => s.incomingGroupCall)

  // Drive the in-call duration timer (1-on-1 only; GroupCallModal owns its own).
  useEffect(() => {
    if (status !== 'connected') return
    let secs = 0
    const id = setInterval(() => {
      secs += 1
      setDuration(secs)
    }, 1000)
    return () => clearInterval(id)
  }, [status, setDuration])

  // ── Group call takes over the screen when active ──────────────────────────
  if (groupCallId) return <GroupCallModal />

  // ── Incoming group-call ring (can co-exist with idle 1-on-1) ──────────────
  if (incomingGroupCall) return <IncomingGroupCall />

  if (status === 'idle') return null

  // ── Incoming call prompt ────────────────────────────────────────────────
  if (status === 'incoming') {
    return (
      <div className="fixed bottom-6 right-6 z-[100] w-[min(90vw,320px)] sm:w-80 rounded-2xl border bg-background p-5 shadow-2xl">
        <p className="text-sm text-muted-foreground">
          {video ? t('incomingVideo') : t('incomingVoice')}
        </p>
        <p className="mt-1 text-lg font-semibold truncate">{peerName || t('peerFallback')}</p>
        <div className="mt-5 flex justify-between gap-3">
          <Button
            variant="destructive"
            className="flex-1 gap-2"
            onClick={() => callManager.endCall()}
          >
            <PhoneOff className="size-4" /> {t('decline')}
          </Button>
          <Button
            className="flex-1 gap-2 bg-[#00C853] hover:bg-[#00B248]"
            onClick={() => callManager.acceptIncoming()}
          >
            {video ? <Video className="size-4" /> : <Phone className="size-4" />} {t('answer')}
          </Button>
        </div>
      </div>
    )
  }

  // ── Outgoing / connected ────────────────────────────────────────────────
  return video ? <VideoCallModal /> : <VoiceCallModal />
}
