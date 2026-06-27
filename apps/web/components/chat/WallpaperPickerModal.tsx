'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Ban, ImagePlus, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { DialogA11yDescription } from '@/components/common/dialog-a11y-description'
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

// Theme catalogue mirrors Flutter chat_wallpaper_dialog.dart exactly (values +
// names). Categories group the presets in the picker; the `preset:<id>` wire
// format is unchanged so old conversations round-trip. The default option (empty
// string) is rendered separately, not as part of any category.
type ThemeItem = { value: string; label: string; swatch: string }
type ThemeCategory = {
  id: string
  labelKey: string   // key into t('...')
  icon: string       // emoji shown in section header
  items: ThemeItem[]
  collapsible?: boolean   // if true, show only first 5 then a toggle
}

const THEME_CATEGORIES: ThemeCategory[] = [
  {
    id: 'colors',
    labelKey: 'wallpaperCategoryColors',
    icon: '🎨',
    collapsible: true,
    items: [
      { value: 'preset:midnight_glow',   label: 'Midnight Glow',   swatch: 'bg-gradient-to-br from-indigo-900 to-slate-950' },
      { value: 'preset:neon_teal',       label: 'Neon Teal',       swatch: 'bg-gradient-to-br from-teal-900 to-cyan-800' },
      { value: 'preset:sunset',          label: 'Sunset',          swatch: 'bg-gradient-to-br from-orange-400 to-purple-600' },
      { value: 'preset:sweet_pink',      label: 'Sweet Pink',      swatch: 'bg-gradient-to-br from-pink-300 to-red-400' },
      { value: 'preset:dark_shadow',     label: 'Dark Shadow',     swatch: 'bg-gradient-to-br from-zinc-800 to-zinc-950' },
      // ↑ first 5 shown by default when collapsible; below hidden until "xem thêm"
      { value: 'preset:ocean_blue',      label: 'Ocean Blue',      swatch: 'bg-gradient-to-br from-blue-700 to-sky-500' },
      { value: 'preset:forest_green',    label: 'Forest Green',    swatch: 'bg-gradient-to-br from-green-800 to-emerald-600' },
      { value: 'preset:purple_haze',     label: 'Purple Haze',     swatch: 'bg-gradient-to-br from-purple-700 to-fuchsia-600' },
      { value: 'preset:warm_amber',      label: 'Warm Amber',      swatch: 'bg-gradient-to-br from-amber-600 to-orange-500' },
      { value: 'preset:rose_gold',       label: 'Rose Gold',       swatch: 'bg-gradient-to-br from-rose-400 to-amber-300' },
      { value: 'preset:storm',           label: 'Storm',           swatch: 'bg-gradient-to-br from-slate-700 to-blue-900' },
      { value: 'preset:cherry_blossom',  label: 'Cherry Blossom',  swatch: 'bg-gradient-to-br from-pink-300 to-rose-300' },
      { value: 'preset:midnight_purple', label: 'Midnight Purple', swatch: 'bg-gradient-to-br from-purple-900 to-indigo-950' },
      { value: 'preset:coral_reef',      label: 'Coral Reef',      swatch: 'bg-gradient-to-br from-red-500 to-orange-400' },
      { value: 'preset:arctic_ice',      label: 'Arctic Ice',      swatch: 'bg-gradient-to-br from-sky-200 to-blue-300' },
    ],
  },
  {
    id: 'vibrant',
    labelKey: 'wallpaperCategoryVibrant',
    icon: '✨',
    items: [
      { value: 'preset:aurora',   label: 'Aurora',     swatch: 'bg-gradient-to-br from-teal-500 via-emerald-600 to-purple-600' },
      { value: 'preset:galaxy',   label: 'Galaxy',     swatch: 'bg-gradient-to-br from-indigo-800 via-purple-800 to-slate-900' },
      { value: 'preset:fire_ice', label: 'Fire & Ice', swatch: 'bg-gradient-to-br from-red-500 to-blue-600' },
      { value: 'preset:tropical', label: 'Tropical',   swatch: 'bg-gradient-to-br from-green-500 via-cyan-500 to-yellow-400' },
      { value: 'preset:candy',    label: 'Candy',      swatch: 'bg-gradient-to-br from-pink-300 via-violet-400 to-cyan-300' },
    ],
  },
  {
    id: 'minimal',
    labelKey: 'wallpaperCategoryMinimal',
    icon: '⬛',
    items: [
      { value: 'preset:pure_dark',  label: 'Pure Dark',  swatch: 'bg-[#050507] border border-zinc-700' },
      { value: 'preset:soft_gray',  label: 'Soft Gray',  swatch: 'bg-zinc-500' },
      { value: 'preset:warm_night', label: 'Warm Night', swatch: 'bg-gradient-to-br from-zinc-800 to-purple-950' },
    ],
  },
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
  const [colorsExpanded, setColorsExpanded] = useState(false)

  // Re-sync from the server-stored conversation wallpaper each time the modal opens.
  const initFromStorage = () => {
    const stored = conversation?.wallpaper ?? ''
    const parsed = splitFit(stored === 'default' ? '' : stored)
    setSelected(parsed.value)
    setFit(parsed.fit)
    setScale(parsed.scale)
    // Auto-expand the collapsible colors section if the current selection is one
    // of the hidden colors (index ≥ 5), so the active swatch stays visible.
    const colorItems = THEME_CATEGORIES[0].items
    const hiddenItems = colorItems.slice(5)
    setColorsExpanded(hiddenItems.some((i) => i.value === parsed.value))
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
      <DialogContent className="max-w-sm sm:max-w-[680px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
          <DialogTitle>{t('wallpaperPickerTitle')}</DialogTitle>
        </DialogHeader>
        <DialogA11yDescription />

        {/* Two-panel body */}
        <div className="flex flex-col sm:flex-row min-h-0" style={{ maxHeight: '60vh' }}>

          {/* LEFT: scrollable theme list */}
          <div className="w-full sm:w-56 border-b sm:border-b-0 sm:border-r border-border/50 overflow-y-auto flex-shrink-0">

            {/* Default item */}
            <button
              onClick={() => setSelected('')}
              className={cn(
                'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                'hover:bg-muted/60',
                selected === '' && !isImage && 'bg-muted',
              )}
            >
              <div className="size-8 rounded-full flex items-center justify-center bg-muted border border-muted-foreground/20 flex-shrink-0">
                <Ban className="size-4 text-muted-foreground" />
              </div>
              <span className="text-sm">{t('wallpaperDefault')}</span>
              {selected === '' && !isImage && (
                <Check className="size-4 text-pon-cyan ml-auto" />
              )}
            </button>

            {/* Categories */}
            {THEME_CATEGORIES.map((cat) => {
              const visibleItems = cat.collapsible && !colorsExpanded
                ? cat.items.slice(0, 5)
                : cat.items
              return (
                <div key={cat.id}>
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-4 py-1.5 mt-1">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t(cat.labelKey)}
                    </span>
                  </div>

                  {/* Theme items */}
                  {visibleItems.map((item) => {
                    const isSel = !isImage && selected === item.value
                    return (
                      <button
                        key={item.value}
                        onClick={() => setSelected(item.value)}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-2 text-left transition-colors',
                          'hover:bg-muted/60',
                          isSel && 'bg-muted',
                        )}
                      >
                        <div className={cn('size-8 rounded-full flex-shrink-0', item.swatch)} />
                        <span className="text-sm truncate">{item.label}</span>
                        {isSel && <Check className="size-4 text-pon-cyan ml-auto flex-shrink-0" />}
                      </button>
                    )
                  })}

                  {/* "Xem thêm / Ẩn bớt" toggle — only for collapsible category */}
                  {cat.collapsible && (
                    <button
                      onClick={() => setColorsExpanded((v) => !v)}
                      className="flex items-center gap-1.5 w-full px-4 py-2 text-xs text-pon-cyan hover:text-pon-cyan/80 transition-colors"
                    >
                      {colorsExpanded ? t('wallpaperShowLess') : t('wallpaperShowMore')}
                    </button>
                  )}
                </div>
              )
            })}

            {/* Upload image */}
            <div className="px-3 py-3 border-t border-border/30 mt-1">
              <input ref={fileInputRef} type="file" accept="image/*"
                     className="hidden" onChange={handleUpload} />
              <Button variant="outline" size="sm" className="w-full"
                      disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading
                  ? <Loader2 className="size-4 animate-spin" />
                  : <ImagePlus className="size-4" />}
                {t('wallpaperUpload')}
              </Button>
            </div>
          </div>

          {/* RIGHT: preview + image controls */}
          <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto min-w-0">
            <p className="text-xs text-muted-foreground">{t('wallpaperPreview')}</p>

            {/* Preview — find swatch from flat list for presets */}
            {(() => {
              const allItems = THEME_CATEGORIES.flatMap((c) => c.items)
              const previewPreset = allItems.find((p) => p.value === selected)
              return (
                <div
                  className={cn(
                    'aspect-[3/4] sm:aspect-[4/5] rounded-xl overflow-hidden border border-border/50 relative bg-center flex-shrink-0',
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
              )
            })()}

            {/* Image fit + scale (only for uploaded images) */}
            {isImage && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{t('wallpaperImageFit')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {FIT_OPTIONS.map((f) => (
                      <button key={f} onClick={() => setFit(f)}
                        className={cn(
                          'py-1.5 rounded-lg text-xs border transition-colors',
                          fit === f
                            ? 'border-pon-cyan text-pon-cyan bg-pon-cyan/10'
                            : 'border-border text-muted-foreground hover:bg-muted/50',
                        )}>
                        {t(f === 'cover' ? 'wallpaperFitCover' : f === 'contain' ? 'wallpaperFitContain' : 'wallpaperFitFill')}
                      </button>
                    ))}
                  </div>
                </div>
                {fit !== 'fill' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t('wallpaperScale')}</span>
                      <span>{scale}%</span>
                    </div>
                    <Slider min={50} max={200} step={5} value={[scale]}
                            onValueChange={([v]) => setScale(v)} className="w-full" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border/50">
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
