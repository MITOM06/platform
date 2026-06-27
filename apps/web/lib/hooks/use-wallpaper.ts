'use client'

import { useEffect, useState } from 'react'
import { absoluteMediaUrl } from '@/lib/media'
import { useConversation } from '@/lib/hooks/use-conversation'

// Optimistic-apply event: the picker fires it with `{ conversationId, value }`
// so the open thread reflects the new wallpaper instantly, before the
// CONVERSATION_UPDATED broadcast round-trips. Server value stays authoritative.
export const WALLPAPER_EVENT = 'wallpaper-changed'
export interface WallpaperEventDetail {
  conversationId: string
  value: string
}

const WALLPAPER_CLASSES: Record<string, string> = {
  // ── existing ──
  default: 'bg-background',
  sunset: 'bg-gradient-to-br from-orange-400/10 via-pink-500/5 to-purple-600/10 dark:from-orange-950/20 dark:via-pink-950/10 dark:to-purple-950/20',
  midnight: 'bg-gradient-to-br from-indigo-950/20 via-slate-900/40 to-purple-950/30 dark:from-indigo-950/40 dark:via-slate-950/60 dark:to-purple-950/50',
  sweet_pink: 'bg-gradient-to-br from-pink-300/10 via-rose-400/5 to-red-400/10 dark:from-pink-950/20 dark:via-rose-950/10 dark:to-red-950/20',
  neon_teal: 'bg-gradient-to-br from-teal-950/20 via-cyan-900/30 to-emerald-950/20 dark:from-teal-950/40 dark:via-cyan-950/50 dark:to-emerald-950/40',
  dark_shadow: 'bg-gradient-to-br from-black/20 via-zinc-900/40 to-zinc-950/30 dark:from-black/65 dark:via-zinc-950/70 dark:to-zinc-950/80',

  // ── màu sắc đơn giản — new colors ──
  ocean_blue: 'bg-gradient-to-br from-blue-950/25 via-sky-900/15 to-blue-950/35 dark:from-blue-950/50 dark:via-sky-950/40 dark:to-blue-950/60',
  forest_green: 'bg-gradient-to-br from-green-950/25 via-emerald-900/15 to-green-950/35 dark:from-green-950/50 dark:via-emerald-950/40 dark:to-green-950/60',
  purple_haze: 'bg-gradient-to-br from-purple-950/25 via-violet-900/15 to-fuchsia-950/25 dark:from-purple-950/50 dark:via-violet-950/40 dark:to-fuchsia-950/50',
  warm_amber: 'bg-gradient-to-br from-amber-950/20 via-yellow-900/10 to-orange-950/20 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/40',
  rose_gold: 'bg-gradient-to-br from-rose-900/20 via-pink-800/10 to-amber-900/15 dark:from-rose-950/40 dark:via-pink-950/30 dark:to-amber-950/35',
  storm: 'bg-gradient-to-br from-slate-900/30 via-blue-950/20 to-slate-900/35 dark:from-slate-950/55 dark:via-blue-950/40 dark:to-slate-950/60',
  cherry_blossom: 'bg-gradient-to-br from-pink-300/8 via-pink-500/5 to-rose-300/8 dark:from-pink-950/30 dark:via-rose-950/20 dark:to-pink-900/30',
  midnight_purple: 'bg-gradient-to-br from-purple-950/35 via-indigo-950/45 to-slate-950/55 dark:from-purple-950/60 dark:via-indigo-950/70 dark:to-slate-950/80',
  coral_reef: 'bg-gradient-to-br from-red-900/20 via-orange-900/12 to-rose-950/20 dark:from-red-950/40 dark:via-orange-950/30 dark:to-rose-950/40',
  arctic_ice: 'bg-gradient-to-br from-sky-200/10 via-blue-100/6 to-cyan-200/8 dark:from-sky-950/30 dark:via-blue-950/20 dark:to-cyan-950/30',

  // ── gradient sống động ──
  aurora: 'bg-gradient-to-br from-teal-900/20 via-emerald-950/15 to-purple-900/20 dark:from-teal-950/45 dark:via-emerald-950/35 dark:to-purple-950/45',
  galaxy: 'bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-slate-950/55 dark:from-indigo-950/65 dark:via-purple-950/55 dark:to-slate-950/75',
  fire_ice: 'bg-gradient-to-br from-red-950/20 via-slate-900/25 to-blue-950/20 dark:from-red-950/40 dark:via-slate-950/45 dark:to-blue-950/40',
  tropical: 'bg-gradient-to-br from-green-900/15 via-cyan-900/10 to-yellow-900/12 dark:from-green-950/40 dark:via-cyan-950/30 dark:to-yellow-950/35',
  candy: 'bg-gradient-to-br from-pink-300/10 via-violet-400/7 to-cyan-300/8 dark:from-pink-950/30 dark:via-violet-950/25 dark:to-cyan-950/30',

  // ── tối giản ──
  pure_dark: 'bg-[#050507] dark:bg-[#030303]',
  soft_gray: 'bg-gradient-to-br from-zinc-700/20 via-zinc-800/15 to-zinc-700/20 dark:from-zinc-800/50 dark:via-zinc-900/60 dark:to-zinc-800/50',
  warm_night: 'bg-gradient-to-br from-zinc-950/40 via-purple-950/10 to-zinc-950/45 dark:from-zinc-950/65 dark:via-purple-950/25 dark:to-zinc-950/70',
}

// Resolve a stored wallpaper value into a class (presets) or an inline image
// style. Format mirrors Flutter (chat_wallpaper_dialog.dart): '' / 'default'
// = default; 'preset:<id>' = gradient preset; 'http...#fit=cover|contain|fill'
// = uploaded image. Old flat keys (e.g. 'midnight') stay supported.
const PRESET_TO_CLASS: Record<string, string> = {
  // existing
  midnight_glow: 'midnight',
  neon_teal: 'neon_teal',
  sunset: 'sunset',
  sweet_pink: 'sweet_pink',
  dark_shadow: 'dark_shadow',
  // new — colors
  ocean_blue: 'ocean_blue',
  forest_green: 'forest_green',
  purple_haze: 'purple_haze',
  warm_amber: 'warm_amber',
  rose_gold: 'rose_gold',
  storm: 'storm',
  cherry_blossom: 'cherry_blossom',
  midnight_purple: 'midnight_purple',
  coral_reef: 'coral_reef',
  arctic_ice: 'arctic_ice',
  // new — gradients
  aurora: 'aurora',
  galaxy: 'galaxy',
  fire_ice: 'fire_ice',
  tropical: 'tropical',
  candy: 'candy',
  // new — minimal
  pure_dark: 'pure_dark',
  soft_gray: 'soft_gray',
  warm_night: 'warm_night',
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
 * Resolves the shared per-conversation wallpaper into a className / inline style.
 * The wallpaper now lives on the Conversation document (server-authoritative,
 * shared across all members) and arrives via the `['conversation', id]` query —
 * refreshed by CONVERSATION_UPDATED. An optimistic `wallpaper-changed` event lets
 * the picker apply the new value instantly before the broadcast round-trips.
 */
export function useWallpaper(conversationId: string): ResolvedWallpaper {
  const { data: conversation } = useConversation(conversationId)
  const serverWallpaper = conversation?.wallpaper ?? 'default'
  const [optimistic, setOptimistic] = useState<string | null>(null)

  // Clear the optimistic override once the server value catches up. Reset during
  // render (React-recommended) instead of in an effect — avoids a cascading render.
  const [prevServer, setPrevServer] = useState(serverWallpaper)
  if (serverWallpaper !== prevServer) {
    setPrevServer(serverWallpaper)
    setOptimistic(null)
  }

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<WallpaperEventDetail>).detail
      if (detail && detail.conversationId === conversationId) {
        setOptimistic(detail.value || 'default')
      }
    }
    window.addEventListener(WALLPAPER_EVENT, onChange)
    return () => window.removeEventListener(WALLPAPER_EVENT, onChange)
  }, [conversationId])

  return resolveWallpaper(optimistic ?? serverWallpaper)
}
