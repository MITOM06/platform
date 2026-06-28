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
  // ── default ──
  default: 'bg-background',

  // ── original 5 ──
  sunset:
    'bg-gradient-to-br from-orange-400/30 via-pink-500/20 to-purple-600/30 dark:from-orange-800/50 dark:via-pink-900/35 dark:to-purple-900/50',
  midnight:
    'bg-gradient-to-br from-indigo-900/45 via-slate-800/55 to-purple-900/50 dark:from-indigo-950/70 dark:via-slate-950/80 dark:to-purple-950/75',
  sweet_pink:
    'bg-gradient-to-br from-pink-300/30 via-rose-400/20 to-red-400/30 dark:from-pink-900/50 dark:via-rose-950/40 dark:to-red-950/50',
  neon_teal:
    'bg-gradient-to-br from-teal-800/40 via-cyan-800/50 to-emerald-800/40 dark:from-teal-950/65 dark:via-cyan-950/75 dark:to-emerald-950/65',
  dark_shadow:
    'bg-gradient-to-br from-black/45 via-zinc-900/60 to-zinc-950/55 dark:from-black/80 dark:via-zinc-950/88 dark:to-zinc-950/90',

  // ── màu sắc đơn giản ──
  ocean_blue:
    'bg-gradient-to-br from-blue-800/40 via-sky-800/30 to-blue-800/50 dark:from-blue-950/70 dark:via-sky-950/60 dark:to-blue-950/80',
  forest_green:
    'bg-gradient-to-br from-green-800/40 via-emerald-800/30 to-green-800/50 dark:from-green-950/70 dark:via-emerald-950/60 dark:to-green-950/80',
  purple_haze:
    'bg-gradient-to-br from-purple-800/40 via-violet-800/30 to-fuchsia-800/40 dark:from-purple-950/70 dark:via-violet-950/60 dark:to-fuchsia-950/70',
  warm_amber:
    'bg-gradient-to-br from-amber-700/35 via-yellow-700/25 to-orange-700/35 dark:from-amber-900/60 dark:via-yellow-950/50 dark:to-orange-900/60',
  rose_gold:
    'bg-gradient-to-br from-rose-700/35 via-pink-700/25 to-amber-700/30 dark:from-rose-900/60 dark:via-pink-950/50 dark:to-amber-900/55',
  storm:
    'bg-gradient-to-br from-slate-700/45 via-blue-900/35 to-slate-700/50 dark:from-slate-950/75 dark:via-blue-950/65 dark:to-slate-950/80',
  cherry_blossom:
    'bg-gradient-to-br from-pink-300/25 via-pink-400/18 to-rose-300/25 dark:from-pink-900/55 dark:via-rose-950/45 dark:to-pink-900/55',
  midnight_purple:
    'bg-gradient-to-br from-purple-900/55 via-indigo-900/65 to-slate-900/70 dark:from-purple-950/80 dark:via-indigo-950/88 dark:to-slate-950/92',
  coral_reef:
    'bg-gradient-to-br from-red-700/40 via-orange-700/30 to-rose-800/40 dark:from-red-900/65 dark:via-orange-950/55 dark:to-rose-950/65',
  arctic_ice:
    'bg-gradient-to-br from-sky-300/25 via-blue-200/18 to-cyan-300/22 dark:from-sky-900/55 dark:via-blue-950/45 dark:to-cyan-950/55',

  // ── gradient sống động ──
  aurora:
    'bg-gradient-to-br from-teal-700/45 via-emerald-800/35 to-purple-700/45 dark:from-teal-950/72 dark:via-emerald-950/60 dark:to-purple-950/72',
  galaxy:
    'bg-gradient-to-br from-indigo-900/65 via-purple-900/55 to-slate-900/75 dark:from-indigo-950/88 dark:via-purple-950/80 dark:to-slate-950/92',
  fire_ice:
    'bg-gradient-to-br from-red-700/45 via-slate-800/40 to-blue-700/45 dark:from-red-900/68 dark:via-slate-950/70 dark:to-blue-900/68',
  tropical:
    'bg-gradient-to-br from-green-700/35 via-cyan-700/28 to-yellow-700/30 dark:from-green-900/62 dark:via-cyan-950/55 dark:to-yellow-900/58',
  candy:
    'bg-gradient-to-br from-pink-400/30 via-violet-400/22 to-cyan-400/25 dark:from-pink-900/55 dark:via-violet-950/48 dark:to-cyan-950/55',

  // ── tối giản ──
  pure_dark: 'bg-[#050507] dark:bg-[#030303]',
  soft_gray:
    'bg-gradient-to-br from-zinc-600/35 via-zinc-700/28 to-zinc-600/35 dark:from-zinc-800/70 dark:via-zinc-900/80 dark:to-zinc-800/70',
  warm_night:
    'bg-gradient-to-br from-zinc-900/60 via-purple-900/25 to-zinc-900/65 dark:from-zinc-950/82 dark:via-purple-950/45 dark:to-zinc-950/85',
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
