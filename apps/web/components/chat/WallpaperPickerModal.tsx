'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Ban, ImagePlus, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

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

function splitFit(raw: string): { value: string; fit: Fit } {
  const idx = raw.indexOf('#fit=')
  if (idx === -1) return { value: raw, fit: 'cover' }
  const fit = raw.slice(idx + 5) as Fit
  return { value: raw.slice(0, idx), fit: FIT_OPTIONS.includes(fit) ? fit : 'cover' }
}

export function WallpaperPickerModal({ conversationId, open, onClose }: Props) {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selected, setSelected] = useState('')
  const [fit, setFit] = useState<Fit>('cover')
  const [uploading, setUploading] = useState(false)

  // Re-sync from storage each time the modal opens.
  const initFromStorage = () => {
    const stored = typeof window !== 'undefined'
      ? localStorage.getItem(`wallpaper-${conversationId}`) ?? ''
      : ''
    const parsed = splitFit(stored === 'default' ? '' : stored)
    setSelected(parsed.value)
    setFit(parsed.fit)
  }

  const isImage = selected.startsWith('http')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await chatService.uploadFile(file)
      setSelected(res.url)
      setFit('cover')
    } catch {
      // upload errors surface via the disabled state; nothing to apply
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConfirm = () => {
    // Encode fit only for uploaded images and only when non-default.
    const value = isImage && fit !== 'cover' ? `${selected}#fit=${fit}` : selected
    localStorage.setItem(`wallpaper-${conversationId}`, value)
    window.dispatchEvent(new Event('wallpaper-changed'))
    // System message so all participants see the change in the thread.
    // Format matches Flutter (system.theme.changed:<value>) for cross-platform parity.
    chatService.sendMessage(conversationId, `system.theme.changed:${value}`, 'system').catch(() => {})
    onClose()
  }

  const previewPreset = PRESETS.find((p) => p.value === selected)

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

        {/* Live preview */}
        <div className="h-28 rounded-xl overflow-hidden border border-border/50 flex items-center justify-center">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={absoluteMediaUrl(selected)}
              alt="preview"
              className={cn(
                'w-full h-full',
                fit === 'contain' ? 'object-contain' : fit === 'fill' ? 'object-fill' : 'object-cover',
              )}
            />
          ) : (
            <div className={cn('w-full h-full', previewPreset?.swatch ?? 'bg-muted')} />
          )}
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

        {/* Image fit selector */}
        {isImage && (
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
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{tCommon('cancel')}</Button>
          <Button onClick={handleConfirm}>{tCommon('confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
