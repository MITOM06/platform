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
import {
  THEME_CATEGORIES, THEMED_PRESETS, FIT_OPTIONS, splitFit, type Fit,
} from './wallpaper-presets'

interface Props {
  conversationId: string
  open: boolean
  onClose: () => void
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

            {/* Chủ đề — image-based themed photo wallpapers */}
            <div className="flex items-center gap-2 px-4 py-1.5 mt-1">
              <span className="text-sm">🌄</span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('wallpaperCategoryThemes')}
              </span>
            </div>
            {THEMED_PRESETS.map((p) => {
              const isSel = selected === p.value
              return (
                <button
                  key={p.value}
                  onClick={() => setSelected(p.value)}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-2 text-left transition-colors',
                    'hover:bg-muted/60',
                    isSel && 'bg-muted',
                  )}
                >
                  <div
                    className={cn(
                      'size-8 rounded-full flex-shrink-0 bg-cover bg-center border',
                      isSel ? 'border-pon-cyan' : 'border-muted-foreground/20',
                    )}
                    style={{ backgroundImage: `url(${p.thumb})` }}
                  />
                  <span className="text-sm truncate">{t(p.label)}</span>
                  {isSel && <Check className="size-4 text-pon-cyan ml-auto flex-shrink-0" />}
                </button>
              )
            })}

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
                        <span className="text-sm truncate">{t(item.label)}</span>
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
