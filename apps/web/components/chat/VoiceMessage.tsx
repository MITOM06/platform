'use client'

import { useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { absoluteMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function VoiceMessage({ content, isOwn }: { content: string; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
    } else {
      a.play().catch(() => {})
    }
  }

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current
    if (!a || !duration) return
    const t = (Number(e.target.value) / 100) * duration
    a.currentTime = t
    setPosition(t)
  }

  const pct = duration > 0 ? (position / duration) * 100 : 0
  const accent = isOwn ? 'accent-primary-foreground' : 'accent-pon-cyan'

  return (
    <div className="flex w-full max-w-[220px] items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          isOwn ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-pon-cyan/20 text-pon-cyan',
        )}
      >
        {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <div className="flex-1">
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={seek}
          className={cn('h-1 w-full cursor-pointer', accent)}
        />
        <span
          className={cn(
            'text-[11px]',
            isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground',
          )}
        >
          {fmt(playing ? position : duration || position)}
        </span>
      </div>
      <audio
        ref={audioRef}
        src={absoluteMediaUrl(content)}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setPosition(0)
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (isFinite(d)) setDuration(d)
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration
          if (isFinite(d)) setDuration(d)
        }}
      />
    </div>
  )
}
