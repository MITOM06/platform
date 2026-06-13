'use client'

import { useEffect, useRef } from 'react'
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { useCallStore } from '@/lib/store/call.store'
import { callManager } from '@/lib/webrtc/call-manager'
import { cn } from '@/lib/utils'

function formatDuration(total: number): string {
  const m = Math.floor(total / 60).toString().padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Two-way video call UI (Zalo style): remote video fullscreen + local PiP.
 * Shown for `video === true` calls. Audio is carried by the video elements.
 */
export function VideoCallModal() {
  const peerName = useCallStore((s) => s.peerName)
  const status = useCallStore((s) => s.status)
  const duration = useCallStore((s) => s.durationSeconds)
  const micEnabled = useCallStore((s) => s.micEnabled)
  const cameraEnabled = useCallStore((s) => s.cameraEnabled)

  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)
  const connected = status === 'connected'

  useEffect(() => {
    callManager.onLocalStream = (stream) => {
      if (localRef.current) localRef.current.srcObject = stream
    }
    callManager.onRemoteStream = (stream) => {
      if (remoteRef.current) remoteRef.current.srcObject = stream
    }
    const local = callManager.getLocalStream()
    if (local && localRef.current) localRef.current.srcObject = local
    const remote = callManager.getRemoteStream()
    if (remote && remoteRef.current) remoteRef.current.srcObject = remote
    return () => {
      callManager.onLocalStream = null
      callManager.onRemoteStream = null
    }
  }, [status])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className={cn('h-full w-full object-cover', !connected && 'opacity-0')}
        />
        {!connected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <div className="size-20 rounded-full bg-white/10 flex items-center justify-center text-3xl font-semibold">
              {(peerName || '?')[0]?.toUpperCase()}
            </div>
            <p className="text-xl font-medium">{peerName || 'Người dùng'}</p>
            <p className="text-sm text-white/70">Đang gọi…</p>
          </div>
        )}

        {connected && (
          <div className="absolute top-6 left-0 right-0 text-center text-white">
            <p className="text-xl font-semibold">{peerName || 'Người dùng'}</p>
            <p className="text-sm text-white/70">{formatDuration(duration)}</p>
          </div>
        )}

        {/* Local PiP */}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-28 right-4 h-40 w-28 rounded-xl border border-white/20 object-cover bg-neutral-900 -scale-x-100"
        />
      </div>

      <div className="flex items-center justify-center gap-5 py-8">
        <button
          onClick={() => callManager.toggleMic(!micEnabled)}
          className={cn(
            'flex size-14 items-center justify-center rounded-full text-white transition-colors',
            micEnabled ? 'bg-white/15 hover:bg-white/25' : 'bg-white/80 text-black',
          )}
          title={micEnabled ? 'Tắt mic' : 'Bật mic'}
        >
          {micEnabled ? <Mic className="size-6" /> : <MicOff className="size-6" />}
        </button>
        <button
          onClick={() => callManager.endCall()}
          className="flex size-16 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
          title="Kết thúc"
        >
          <PhoneOff className="size-7" />
        </button>
        <button
          onClick={() => callManager.toggleCamera(!cameraEnabled)}
          className={cn(
            'flex size-14 items-center justify-center rounded-full text-white transition-colors',
            cameraEnabled ? 'bg-white/15 hover:bg-white/25' : 'bg-white/80 text-black',
          )}
          title={cameraEnabled ? 'Tắt camera' : 'Bật camera'}
        >
          {cameraEnabled ? <Video className="size-6" /> : <VideoOff className="size-6" />}
        </button>
      </div>
    </div>
  )
}
