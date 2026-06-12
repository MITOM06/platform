'use client'

import { useEffect, useRef } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { useCallStore } from '@/lib/store/call.store'
import { callManager } from '@/lib/webrtc/call-manager'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function formatDuration(total: number): string {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Global call UI. Mounted once in the (main) layout. Renders nothing while
 * idle; otherwise shows the incoming prompt, the outgoing "calling" state, or
 * the connected in-call view bound to the [callManager] media streams.
 */
export function CallOverlay() {
  const status = useCallStore((s) => s.status)
  const peerName = useCallStore((s) => s.peerName)
  const duration = useCallStore((s) => s.durationSeconds)
  const micEnabled = useCallStore((s) => s.micEnabled)
  const cameraEnabled = useCallStore((s) => s.cameraEnabled)
  const setDuration = useCallStore((s) => s.setDuration)

  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)

  // Bind media streams from the manager to the <video> elements.
  useEffect(() => {
    callManager.onLocalStream = (stream) => {
      if (localRef.current) localRef.current.srcObject = stream
    }
    callManager.onRemoteStream = (stream) => {
      if (remoteRef.current) remoteRef.current.srcObject = stream
    }
    // If streams already exist (e.g. element mounts after the callback fired).
    const local = callManager.getLocalStream()
    if (local && localRef.current) localRef.current.srcObject = local
    const remote = callManager.getRemoteStream()
    if (remote && remoteRef.current) remoteRef.current.srcObject = remote
    return () => {
      callManager.onLocalStream = null
      callManager.onRemoteStream = null
    }
  }, [status])

  // Drive the in-call duration timer.
  useEffect(() => {
    if (status !== 'connected') return
    let secs = 0
    const id = setInterval(() => {
      secs += 1
      setDuration(secs)
    }, 1000)
    return () => clearInterval(id)
  }, [status, setDuration])

  if (status === 'idle') return null

  // ── Incoming call prompt ────────────────────────────────────────────────
  if (status === 'incoming') {
    return (
      <div className="fixed bottom-6 right-6 z-[100] w-80 rounded-2xl border bg-background p-5 shadow-2xl">
        <p className="text-sm text-muted-foreground">Cuộc gọi đến</p>
        <p className="mt-1 text-lg font-semibold truncate">{peerName || 'Người dùng'}</p>
        <div className="mt-5 flex justify-between gap-3">
          <Button
            variant="destructive"
            className="flex-1 gap-2"
            onClick={() => callManager.endCall()}
          >
            <PhoneOff className="size-4" /> Từ chối
          </Button>
          <Button
            className="flex-1 gap-2 bg-[#00C853] hover:bg-[#00B248]"
            onClick={() => callManager.acceptIncoming()}
          >
            <Phone className="size-4" /> Trả lời
          </Button>
        </div>
      </div>
    )
  }

  // ── Outgoing / connected full-screen view ───────────────────────────────
  const connected = status === 'connected'
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Remote video (or placeholder while ringing) */}
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

        {/* Header info when connected */}
        {connected && (
          <div className="absolute top-6 left-0 right-0 text-center text-white">
            <p className="text-xl font-semibold">{peerName || 'Người dùng'}</p>
            <p className="text-sm text-white/70">{formatDuration(duration)}</p>
          </div>
        )}

        {/* Local PiP video */}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-28 right-4 h-40 w-28 rounded-xl border border-white/20 object-cover bg-neutral-900 -scale-x-100"
        />
      </div>

      {/* Controls */}
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
