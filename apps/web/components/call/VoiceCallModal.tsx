'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { PhoneOff, Mic, MicOff } from 'lucide-react'
import { useCallStore } from '@/lib/store/call.store'
import { callManager } from '@/lib/webrtc/call-manager'
import { cn } from '@/lib/utils'

function formatDuration(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Audio-only voice call UI: large avatar + animated waveform, no video.
 * Shown for `video === false` calls. Remote audio plays through a hidden
 * <audio> element (there is no <video> element to carry it).
 */
export function VoiceCallModal() {
  const t = useTranslations('call')
  const peerName = useCallStore((s) => s.peerName)
  const status = useCallStore((s) => s.status)
  const duration = useCallStore((s) => s.durationSeconds)
  const micEnabled = useCallStore((s) => s.micEnabled)

  const audioRef = useRef<HTMLAudioElement>(null)
  const connected = status === 'connected'

  useEffect(() => {
    callManager.onRemoteStream = (stream) => {
      if (audioRef.current) audioRef.current.srcObject = stream
    }
    const remote = callManager.getRemoteStream()
    if (remote && audioRef.current) audioRef.current.srcObject = remote
    return () => {
      callManager.onRemoteStream = null
    }
  }, [status])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 via-black to-slate-950 py-16">
      {/* Remote audio sink (no video element in a voice call) */}
      <audio ref={audioRef} autoPlay className="hidden" />

      <div className="flex flex-col items-center gap-5 mt-16">
        <div className="size-32 rounded-full bg-gradient-to-br from-pon-cyan/40 to-pon-peach/40 flex items-center justify-center text-5xl font-semibold text-white ring-4 ring-white/10">
          {(peerName || '?')[0]?.toUpperCase()}
        </div>
        <p className="text-2xl font-semibold text-white">{peerName || t('peerFallback')}</p>
        <p className="text-sm text-white/60">
          {connected ? formatDuration(duration) : t('calling')}
        </p>

        {/* Animated audio waveform (purely visual) */}
        {connected && (
          <div className="flex items-end gap-1.5 h-10">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-pon-cyan/80 animate-pulse"
                style={{
                  height: `${30 + ((i * 13) % 70)}%`,
                  animationDelay: `${i * 120}ms`,
                  animationDuration: '900ms',
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => callManager.toggleMic(!micEnabled)}
          className={cn(
            'flex size-14 items-center justify-center rounded-full text-white transition-colors',
            micEnabled ? 'bg-white/15 hover:bg-white/25' : 'bg-white/80 text-black',
          )}
          title={micEnabled ? t('muteMic') : t('unmuteMic')}
        >
          {micEnabled ? <Mic className="size-6" /> : <MicOff className="size-6" />}
        </button>
        <button
          onClick={() => callManager.endCall()}
          className="flex size-16 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
          title={t('endCall')}
        >
          <PhoneOff className="size-7" />
        </button>
      </div>
    </div>
  )
}
