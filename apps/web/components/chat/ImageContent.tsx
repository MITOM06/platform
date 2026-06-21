'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import NextImage from 'next/image'
import { Download, X, ChevronLeft, ChevronRight, Play, ImageOff } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { absoluteMediaUrl, downloadMediaUrl, parseImageUrls } from '@/lib/media'
import { cn } from '@/lib/utils'

// ── Single image / collage grid (mirror Flutter image_content.dart) ───────────

function Tile({
  url,
  className,
  onClick,
  overlay,
}: {
  url: string
  className?: string
  onClick: () => void
  overlay?: string
}) {
  const [errored, setErrored] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('relative overflow-hidden bg-black/20', className)}
    >
      {errored ? (
        <div className="flex size-full items-center justify-center text-white/50">
          <ImageOff className="size-6" />
        </div>
      ) : (
        <NextImage
          src={absoluteMediaUrl(url)}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 320px"
          className="object-cover"
          onError={() => setErrored(true)}
        />
      )}
      {overlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-xl font-bold text-white">
          {overlay}
        </div>
      )}
    </button>
  )
}

export function ImageContent({ content }: { content: string }) {
  const urls = parseImageUrls(content)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const open = (i: number) => setLightboxIndex(i)

  let grid: React.ReactNode
  if (urls.length === 1) {
    grid = (
      <Tile
        url={urls[0]}
        onClick={() => open(0)}
        className="max-h-[280px] max-w-[240px] rounded-2xl [&>img]:max-h-[280px] [&>img]:w-auto"
      />
    )
  } else if (urls.length === 2) {
    grid = (
      <div className="grid w-[240px] grid-cols-2 gap-0.5 overflow-hidden rounded-2xl">
        {urls.map((u, i) => (
          <Tile key={i} url={u} onClick={() => open(i)} className="h-[180px]" />
        ))}
      </div>
    )
  } else if (urls.length === 3) {
    grid = (
      <div className="flex w-[240px] gap-0.5 overflow-hidden rounded-2xl">
        <Tile url={urls[0]} onClick={() => open(0)} className="h-[200px] flex-[0.62]" />
        <div className="flex flex-1 flex-col gap-0.5">
          <Tile url={urls[1]} onClick={() => open(1)} className="h-[99px]" />
          <Tile url={urls[2]} onClick={() => open(2)} className="h-[99px]" />
        </div>
      </div>
    )
  } else {
    const extras = urls.length - 4
    grid = (
      <div className="grid w-[240px] grid-cols-2 gap-0.5 overflow-hidden rounded-2xl">
        {urls.slice(0, 4).map((u, i) => (
          <Tile
            key={i}
            url={u}
            onClick={() => open(i)}
            className="h-[119px]"
            overlay={i === 3 && extras > 0 ? `+${extras}` : undefined}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      {grid}
      <Lightbox
        urls={urls}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </>
  )
}

function Lightbox({
  urls,
  index,
  onClose,
  onIndexChange,
}: {
  urls: string[]
  index: number | null
  onClose: () => void
  onIndexChange: (i: number) => void
}) {
  const t = useTranslations('chat')
  if (index === null) return null
  const hasMany = urls.length > 1
  const prev = () => onIndexChange((index - 1 + urls.length) % urls.length)
  const next = () => onIndexChange((index + 1) % urls.length)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex max-w-[95vw] items-center justify-center border-none bg-black/95 p-0 sm:max-w-[90vw]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t('imageViewer')}</DialogTitle>
        <div className="relative flex h-[85vh] w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={absoluteMediaUrl(urls[index])}
            alt=""
            className="max-h-full max-w-full object-contain"
          />

          <div className="absolute right-3 top-3 flex items-center gap-2">
            {hasMany && (
              <span className="rounded-full bg-black/60 px-2 py-1 text-xs text-white/80">
                {index + 1} / {urls.length}
              </span>
            )}
            <a
              href={downloadMediaUrl(urls[index])}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            >
              <Download className="size-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            >
              <X className="size-4" />
            </button>
          </div>

          {hasMany && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Video (thumbnail card opening in a new tab) ───────────────────────────────

export function VideoContent({ content }: { content: string }) {
  return (
    <a
      href={absoluteMediaUrl(content)}
      target="_blank"
      rel="noopener noreferrer"
      className="relative flex h-[150px] w-[220px] items-center justify-center overflow-hidden rounded-2xl bg-black"
    >
      <div className="rounded-full bg-black/50 p-2.5">
        <Play className="size-7 fill-white text-white" />
      </div>
    </a>
  )
}
