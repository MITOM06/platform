'use client'

import { useEffect, useState } from 'react'
import { absoluteMediaUrl } from '@/lib/media'

const WALLPAPER_CLASSES: Record<string, string> = {
  default: 'bg-background',
  sunset: 'bg-gradient-to-br from-orange-400/10 via-pink-500/5 to-purple-600/10 dark:from-orange-950/20 dark:via-pink-950/10 dark:to-purple-950/20',
  midnight: 'bg-gradient-to-br from-indigo-950/20 via-slate-900/40 to-purple-950/30 dark:from-indigo-950/40 dark:via-slate-950/60 dark:to-purple-950/50',
  sweet_pink: 'bg-gradient-to-br from-pink-300/10 via-rose-400/5 to-red-400/10 dark:from-pink-950/20 dark:via-rose-950/10 dark:to-red-950/20',
  neon_teal: 'bg-gradient-to-br from-teal-950/20 via-cyan-900/30 to-emerald-950/20 dark:from-teal-950/40 dark:via-cyan-950/50 dark:to-emerald-950/40',
  dark_shadow: 'bg-gradient-to-br from-black/20 via-zinc-900/40 to-zinc-950/30 dark:from-black/65 dark:via-zinc-950/70 dark:to-zinc-950/80',
}

// Resolve a stored wallpaper value into a class (presets) or an inline image
// style. Format mirrors Flutter (chat_wallpaper_dialog.dart): '' / 'default'
// = default; 'preset:<id>' = gradient preset; 'http...#fit=cover|contain|fill'
// = uploaded image. Old flat keys (e.g. 'midnight') stay supported.
const PRESET_TO_CLASS: Record<string, string> = {
  midnight_glow: 'midnight',
  neon_teal: 'neon_teal',
  sunset: 'sunset',
  sweet_pink: 'sweet_pink',
  dark_shadow: 'dark_shadow',
}

export interface ResolvedWallpaper {
  className?: string
  style?: React.CSSProperties
  isImage: boolean
}

function resolveWallpaper(raw: string): ResolvedWallpaper {
  if (!raw || raw === 'default') {
    return { className: WALLPAPER_CLASSES.default, isImage: false }
  }
  // Legacy flat keys (e.g. 'sunset') stored before the 'preset:' prefix was
  // introduced must be resolved as presets, not image URLs.
  const isLegacyPreset = !raw.startsWith('preset:') && raw in PRESET_TO_CLASS
  if (!raw.startsWith('preset:') && !isLegacyPreset) {
    // Parse `<url>#fit=<fit>&scale=<n>` (backward compatible with `#fit=` only).
    const hashIdx = raw.indexOf('#')
    const url = hashIdx === -1 ? raw : raw.slice(0, hashIdx)
    const params = hashIdx === -1 ? new URLSearchParams() : new URLSearchParams(raw.slice(hashIdx + 1))
    const fit = params.get('fit')
    const scaleRaw = Number(params.get('scale'))
    const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 100
    const bgSize = fit === 'fill'
      ? '100% 100%'
      : fit === 'contain'
        ? 'contain'
        // cover at default scale → use the `cover` keyword; a custom scale
        // overrides it with an explicit percentage.
        : scale === 100
          ? 'cover'
          : `${scale}%`
    return {
      style: {
        backgroundImage: `url(${absoluteMediaUrl(url)})`,
        backgroundSize: bgSize,
        backgroundPosition: 'center',
      },
      isImage: true,
    }
  }
  const id = raw.startsWith('preset:') ? raw.slice('preset:'.length) : raw
  const key = PRESET_TO_CLASS[id] ?? id
  return { className: WALLPAPER_CLASSES[key] ?? WALLPAPER_CLASSES.default, isImage: false }
}

/**
 * Reads the per-conversation wallpaper from localStorage and resolves it into a
 * className / inline style. Listens for the `wallpaper-changed` event so a live
 * change in the settings dialog reflects immediately.
 */
export function useWallpaper(conversationId: string): ResolvedWallpaper {
  const [wallpaper, setWallpaper] = useState<string>('default')

  useEffect(() => {
    const loadWallpaper = () => {
      const stored = localStorage.getItem(`wallpaper-${conversationId}`)
      setWallpaper(stored || 'default')
    }
    loadWallpaper()
    window.addEventListener('wallpaper-changed', loadWallpaper)
    return () => window.removeEventListener('wallpaper-changed', loadWallpaper)
  }, [conversationId])

  return resolveWallpaper(wallpaper)
}
