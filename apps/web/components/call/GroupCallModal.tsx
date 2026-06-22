'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PhoneOff, Mic, MicOff, Video, VideoOff, Sparkles, Users } from 'lucide-react'
import { useCallStore } from '@/lib/store/call.store'
import { groupCallManager } from '@/lib/webrtc/group-call-manager'
import { useCallTranscriber } from '@/lib/hooks/use-call-transcriber'
import { useAuthStore } from '@/lib/store/auth.store'
import { ParticipantTileGrid } from './ParticipantTileGrid'
import { cn } from '@/lib/utils'

function formatDuration(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Full-screen group-call UI (Track A §3). Video/avatar grid of participants,
 * live roster count, mic/cam toggles, leave button, and an "AI is taking notes"
 * banner when the notetaker is on. Mounted by CallOverlay while a group call is
 * active. Drives client-side STT via useCallTranscriber.
 */
export function GroupCallModal() {
  const t = useTranslations('call')
  const callId = useCallStore((s) => s.groupCallId)
  const media = useCallStore((s) => s.groupMedia)
  const aiNotetaker = useCallStore((s) => s.groupAiNotetaker)
  const active = useCallStore((s) => s.groupActive)
  const roster = useCallStore((s) => s.roster)
  const micEnabled = useCallStore((s) => s.micEnabled)
  const cameraEnabled = useCallStore((s) => s.cameraEnabled)
  const duration = useCallStore((s) => s.durationSeconds)
  const setDuration = useCallStore((s) => s.setDuration)
  const currentUser = useAuthStore((s) => s.user)

  const isVideo = media === 'video'
  const joinedCount = roster.filter((p) => !p.leftAt).length

  // Client-side STT — only transcribes the local mic while the notetaker is on.
  useCallTranscriber(callId, aiNotetaker)

  // Duration timer (group call has its own; CallOverlay's only ticks 1-on-1).
  useEffect(() => {
    if (!active) return
    let secs = 0
    const id = setInterval(() => {
      secs += 1
      setDuration(secs)
    }, 1000)
    return () => clearInterval(id)
  }, [active, setDuration])

  // Bind the local preview to the grid once media is ready.
  useEffect(() => {
    groupCallManager.onLocalStream = () => useCallStore.getState().bumpStreams()
    // Trigger an initial render in case the stream already exists.
    useCallStore.getState().bumpStreams()
    return () => {
      groupCallManager.onLocalStream = null
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-slate-900 via-black to-slate-950">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-5 pt-5 text-white">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-white/70" />
          <span className="text-sm font-medium">{t('groupParticipants', { count: joinedCount })}</span>
        </div>
        <span className="text-sm text-white/70">
          {active ? formatDuration(duration) : t('connecting')}
        </span>
      </div>

      {/* AI notetaker banner */}
      {aiNotetaker && (
        <div className="mx-auto mt-3 flex items-center gap-2 rounded-full border border-pon-cyan/30 bg-pon-cyan/10 px-4 py-1.5 text-xs font-medium text-pon-cyan">
          <Sparkles className="size-3.5 animate-pulse" />
          {t('aiTakingNotes')}
        </div>
      )}

      {/* Tile grid */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto py-4">
        <ParticipantTileGrid youLabel={`${currentUser?.displayName ?? ''} (${t('you')})`} />
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center justify-center gap-5 py-8">
        <button
          onClick={() => groupCallManager.toggleMic(!micEnabled)}
          className={cn(
            'flex size-14 items-center justify-center rounded-full text-white transition-colors',
            micEnabled ? 'bg-white/15 hover:bg-white/25' : 'bg-white/80 text-black',
          )}
          title={micEnabled ? t('muteMic') : t('unmuteMic')}
        >
          {micEnabled ? <Mic className="size-6" /> : <MicOff className="size-6" />}
        </button>

        <button
          onClick={() => groupCallManager.leave()}
          className="flex size-16 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
          title={t('leaveCall')}
        >
          <PhoneOff className="size-7" />
        </button>

        {isVideo && (
          <button
            onClick={() => groupCallManager.toggleCamera(!cameraEnabled)}
            className={cn(
              'flex size-14 items-center justify-center rounded-full text-white transition-colors',
              cameraEnabled ? 'bg-white/15 hover:bg-white/25' : 'bg-white/80 text-black',
            )}
            title={cameraEnabled ? t('disableCamera') : t('enableCamera')}
          >
            {cameraEnabled ? <Video className="size-6" /> : <VideoOff className="size-6" />}
          </button>
        )}
      </div>
    </div>
  )
}
