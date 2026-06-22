'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Ban, ImagePlus, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'
import { useConversation } from '@/lib/hooks/use-conversation'
import { WALLPAPER_EVENT, type WallpaperEventDetail } from '@/lib/hooks/use-wallpaper'

interface Props {
  conversationId: string
  open: boolean
  onClose: () => void
}

// Presets mirror Flutter chat_wallpaper_dialog.dart exactly (value + names).
// Default is the empty string so it round-trips through localStorage cleanly.
const PRESETS: { value: string; label: string; swatch: string }[] = [
  { value: '', label: 'Default', swatch: 'bg-muted border border-muted-foreground/20' },
  { value: 'preset:midnight_glow', label: 'Midnight Glow', swatch: 'bg-gradient-to-br from-indigo-900 to-slate-950' },
  { value: 'preset:neon_teal', label: 'Neon Teal', swatch: 'bg-gradient-to-br from-teal-900 to-cyan-800' },
  { value: 'preset:sunset', label: 'Sunset', swatch: 'bg-gradient-to-br from-orange-400 to-purple-600' },
  { value: 'preset:sweet_pink', label: 'Sweet Pink', swatch: 'bg-gradient-to-br from-pink-300 to-red-400' },
  { value: 'preset:dark_shadow', label: 'Dark Shadow', swatch: 'bg-gradient-to-br from-zinc-800 to-zinc-950' },
]

const FIT_OPTIONS = ['cover', 'contain', 'fill'] as const
type Fit = (typeof FIT_OPTIONS)[number]

// Parse the stored value `<url>#fit=<fit>&scale=<n>` into its parts. Backward
// compatible with `#fit=` only and bare preset/flat keys (Flutter ignores the
// `&scale=` suffix — it reads the URL before `#`).
function splitFit(raw: string): { value: string; fit: Fit; scale: number } {
  const hashIdx = raw.indexOf('#')
  if (hashIdx === -1) return { value: raw, fit: 'cover', scale: 100 }
  const value = raw.slice(0, hashIdx)
  const params = new URLSearchParams(raw.slice(hashIdx + 1))
  const fitRaw = params.get('fit') as Fit | null
  const fit = fitRaw && FIT_OPTIONS.includes(fitRaw) ? fitRaw : 'cover'
  const scaleRaw = Number(params.get('scale'))
  const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 100
  return { value, fit, scale }
}

export function WallpaperPickerModal({ conversationId, open, onClose }: Props) {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: conversation } = useConversation(conversationId)

  const [selected, setSelected] = useState('')
  const [fit, setFit] = useState<Fit>('cover')
  const [scale, setScale] = useState(100)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Re-sync from the server-stored conversation wallpaper each time the modal opens.
  const initFromStorage = () => {
    const stored = conversation?.wallpaper ?? ''
    const parsed = splitFit(stored === 'default' ? '' : stored)
    setSelected(parsed.value)
    setFit(parsed.fit)
    setScale(parsed.scale)
  }

  const isImage = selected !== '' && !selected.startsWith('preset:')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await chatService.uploadFile(file)
      setSelected(res.url)
      setFit('cover')
      setScale(100)
    } catch {
      toast.error(t('wallpaperUploadError'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConfirm = async () => {
    // Encode fit + scale only for uploaded images and only when non-default.
    let value = selected
    if (isImage && (fit !== 'cover' || scale !== 100)) {
      value = `${selected}#fit=${fit}&scale=${scale}`
    }
    // Optimistically apply locally so the open thread updates instantly, then
    // persist server-side (shared across ALL members) via the conversation doc.
    window.dispatchEvent(
      new CustomEvent<WallpaperEventDetail>(WALLPAPER_EVENT, {
        detail: { conversationId, value },
      }),
    )
    setSaving(true)
    try {
      // Backend broadcasts CONVERSATION_UPDATED → every member re-resolves it.
      await chatService.setWallpaper(conversationId, value)
      onClose()
    } catch {
      toast.error(t('wallpaperSaveError'))
    } finally {
      setSaving(false)
    }
  }

  const previewPreset = PRESETS.find((p) => p.value === selected)

  // Background style for the mock-chat preview — mirrors page.tsx resolveWallpaper.
  const previewBgStyle: React.CSSProperties = isImage
    ? {
        backgroundImage: `url(${absoluteMediaUrl(selected)})`,
        backgroundSize: fit === 'fill'
          ? '100% 100%'
          : fit === 'contain'
            ? 'contain'
            : scale === 100 ? 'cover' : `${scale}%`,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : {}

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) initFromStorage()
        else onClose()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('wallpaperPickerTitle')}</DialogTitle>
        </DialogHeader>

        {/* Mock-chat live preview — dummy bubbles over the chosen background */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t('wallpaperPreview')}</p>
          <div
            className={cn(
              'h-40 rounded-xl overflow-hidden border border-border/50 relative bg-center',
              !isImage && (previewPreset?.swatch ?? 'bg-muted'),
            )}
            style={previewBgStyle}
          >
            <div className="absolute inset-0 bg-background/10 dark:bg-background/30" />
            <div className="relative z-10 flex flex-col justify-end h-full gap-1.5 p-3">
              <div className="flex justify-start">
                <div className="max-w-[70%] rounded-2xl rounded-tl-none bg-muted/90 text-foreground border border-border/50 px-3 py-1.5 text-xs shadow-sm">
                  {t('inputPlaceholder')}
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[70%] rounded-2xl rounded-tr-none bg-primary text-primary-foreground px-3 py-1.5 text-xs shadow-sm">
                  👍
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[70%] rounded-2xl rounded-tl-none bg-muted/90 text-foreground border border-border/50 px-3 py-1.5 text-xs shadow-sm">
                  ✨
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preset grid */}
        <div className="grid grid-cols-3 gap-3">
          {PRESETS.map((p) => {
            const isSel = !isImage && selected === p.value
            return (
              <button
                key={p.value || 'default'}
                onClick={() => setSelected(p.value)}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className={cn(
                    'size-12 rounded-full flex items-center justify-center transition-all',
                    p.swatch,
                    isSel ? 'ring-2 ring-pon-cyan ring-offset-2 ring-offset-background' : 'opacity-90',
                  )}
                >
                  {p.value === '' ? (
                    <Ban className="size-5 text-muted-foreground" />
                  ) : isSel ? (
                    <Check className="size-5 text-white" />
                  ) : null}
                </div>
                <span className="text-[11px] text-muted-foreground text-center truncate w-full">
                  {p.value === '' ? t('wallpaperDefault') : p.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          variant="outline"
          className="w-full"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {t('wallpaperUpload')}
        </Button>

        {/* Image fit selector + scale slider */}
        {isImage && (
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t('wallpaperImageFit')}</p>
              <div className="grid grid-cols-3 gap-2">
                {FIT_OPTIONS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFit(f)}
                    className={cn(
                      'py-1.5 rounded-lg text-xs border transition-colors',
                      fit === f
                        ? 'border-pon-cyan text-pon-cyan bg-pon-cyan/10'
                        : 'border-border text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    {t(f === 'cover' ? 'wallpaperFitCover' : f === 'contain' ? 'wallpaperFitContain' : 'wallpaperFitFill')}
                  </button>
                ))}
              </div>
            </div>

            {/* Scale slider (disabled for `fill`, which always stretches 100% 100%) */}
            {fit !== 'fill' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('wallpaperScale')}</span>
                  <span>{scale}%</span>
                </div>
                <Slider
                  min={50}
                  max={200}
                  step={5}
                  value={[scale]}
                  onValueChange={([v]) => setScale(v)}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{tCommon('cancel')}</Button>
          <Button onClick={handleConfirm} disabled={saving || uploading}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {tCommon('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
