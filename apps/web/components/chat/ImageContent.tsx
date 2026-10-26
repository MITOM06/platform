
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, X, ChevronLeft, ChevronRight, Play, ImageOff } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DialogA11yDescription } from '@/components/common/dialog-a11y-description'
import { absoluteMediaUrl, downloadMediaUrl, parseImageUrls } from '@/lib/media'
import { cn } from '@/lib/utils'

// ── Single image / collage grid ───────────────────────────────────────────────

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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={absoluteMediaUrl(url)}
          alt=""
          className="size-full object-cover"
          onError={() => setErrored(true)}
          loading="lazy"
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
        className="h-auto max-h-[340px] w-full max-w-[320px] rounded-xl [&>img]:h-auto [&>img]:max-h-[340px] [&>img]:w-full [&>img]:object-contain"
      />
    )
  } else if (urls.length === 2) {
    grid = (
      <div className="grid w-full max-w-[320px] grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
        {urls.map((u, i) => (
          <Tile key={i} url={u} onClick={() => open(i)} className="h-[160px]" />
        ))}
      </div>
    )
  } else if (urls.length === 3) {
    grid = (
      <div className="flex w-full max-w-[320px] gap-0.5 overflow-hidden rounded-xl">
        <Tile
          url={urls[0]}
          onClick={() => open(0)}
          className="h-[200px] flex-[0.62]"
        />
        <div className="flex flex-1 flex-col gap-0.5">
          <Tile url={urls[1]} onClick={() => open(1)} className="h-[99px]" />
          <Tile url={urls[2]} onClick={() => open(2)} className="h-[99px]" />
        </div>
      </div>
    )
  } else {
    const extras = urls.length - 4

    grid = (
      <div className="grid w-full max-w-[320px] grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
        {urls.slice(0, 4).map((u, i) => (
          <Tile
            key={i}
            url={u}
            onClick={() => open(i)}
            className="h-[159px]"
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

// ── Full-screen image viewer ──────────────────────────────────────────────────

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
        className="flex h-[92dvh] w-[95vw] max-h-[92dvh] max-w-[95vw] items-center justify-center overflow-hidden border-none bg-black/85 p-2 sm:max-w-[95vw] sm:p-3"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t('imageViewer')}</DialogTitle>
        <DialogA11yDescription />

        <div className="relative flex max-h-full max-w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={absoluteMediaUrl(urls[index])}
            alt=""
            className="block h-auto max-h-[86dvh] w-auto max-w-full rounded-sm object-contain"
          />

          <div className="absolute right-3 top-3 flex items-center gap-2">
            {hasMany && (
              <span className="rounded-full bg-black/60 px-2 py-1 text-xs text-white/80">
                {index + 1} / {urls.length}
              </span>
            )}

            <a
              href={absoluteMediaUrl(urls[index])}
              target="_blank"
              rel="noopener noreferrer"
              title={t('imageViewHd')}
              className="rounded-full bg-black/60 px-2.5 py-2 text-xs font-semibold leading-none text-white hover:bg-black/80"
            >
              HD
            </a>

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
              aria-label={t('imageViewer')}
            >
              <X className="size-4" />
            </button>
          </div>

          {hasMany && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous image"
                className="absolute left-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              >
                <ChevronLeft className="size-5" />
              </button>

              <button
                type="button"
                onClick={next}
                aria-label="Next image"
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

// ── Video thumbnail and viewer ────────────────────────────────────────────────

export function VideoContent({ content }: { content: string }) {
  const t = useTranslations('chat')
  const [open, setOpen] = useState(false)
  const url = absoluteMediaUrl(content)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative flex h-[150px] w-[220px] items-center justify-center overflow-hidden rounded-xl bg-black"
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={url}
          preload="metadata"
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/20" />

        <div className="relative rounded-full bg-black/50 p-2.5 transition-colors group-hover:bg-black/70">
          <Play className="size-7 fill-white text-white" />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex h-[92dvh] w-[95vw] max-h-[92dvh] max-w-[95vw] items-center justify-center overflow-hidden border-none bg-black/85 p-2 sm:max-w-[95vw] sm:p-3"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">{t('videoViewer')}</DialogTitle>
          <DialogA11yDescription />

          <div className="relative flex max-h-full max-w-full items-center justify-center">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={url}
              controls
              autoPlay
              playsInline
              className="block h-auto max-h-[86dvh] w-auto max-w-full rounded-sm object-contain outline-none"
            />

            <div className="absolute right-3 top-3 flex gap-2">
              <a
                href={downloadMediaUrl(content)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label="Download video"
              >
                <Download className="size-4" />
              </a>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label={t('videoViewer')}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
