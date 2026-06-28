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
    'bg-gradient-to-br from-orange-400/85 via-pink-500/75 to-purple-600/85 dark:from-orange-800/90 dark:via-pink-900/85 dark:to-purple-900/90',
  midnight:
    'bg-gradient-to-br from-indigo-900/90 via-slate-800/92 to-purple-900/90 dark:from-indigo-950/95 dark:via-slate-950/97 dark:to-purple-950/95',
  sweet_pink:
    'bg-gradient-to-br from-pink-300/80 via-rose-400/75 to-red-400/80 dark:from-pink-900/88 dark:via-rose-950/85 dark:to-red-950/88',
  neon_teal:
    'bg-gradient-to-br from-teal-800/88 via-cyan-800/90 to-emerald-800/88 dark:from-teal-950/93 dark:via-cyan-950/95 dark:to-emerald-950/93',
  dark_shadow:
    'bg-gradient-to-br from-black/90 via-zinc-900/93 to-zinc-950/92 dark:from-black/97 dark:via-zinc-950/98 dark:to-zinc-950/98',

  // ── màu sắc đơn giản ──
  ocean_blue:
    'bg-gradient-to-br from-blue-800/85 via-sky-800/80 to-blue-800/88 dark:from-blue-950/92 dark:via-sky-950/90 dark:to-blue-950/95',
  forest_green:
    'bg-gradient-to-br from-green-800/85 via-emerald-800/80 to-green-800/88 dark:from-green-950/92 dark:via-emerald-950/90 dark:to-green-950/95',
  purple_haze:
    'bg-gradient-to-br from-purple-800/85 via-violet-800/80 to-fuchsia-800/85 dark:from-purple-950/92 dark:via-violet-950/88 dark:to-fuchsia-950/92',
  warm_amber:
    'bg-gradient-to-br from-amber-700/82 via-yellow-700/78 to-orange-700/82 dark:from-amber-900/90 dark:via-yellow-950/88 dark:to-orange-900/90',
  rose_gold:
    'bg-gradient-to-br from-rose-700/82 via-pink-700/78 to-amber-700/80 dark:from-rose-900/90 dark:via-pink-950/88 dark:to-amber-900/88',
  storm:
    'bg-gradient-to-br from-slate-700/88 via-blue-900/85 to-slate-700/90 dark:from-slate-950/95 dark:via-blue-950/93 dark:to-slate-950/97',
  cherry_blossom:
    'bg-gradient-to-br from-pink-300/78 via-pink-400/72 to-rose-300/78 dark:from-pink-900/88 dark:via-rose-950/85 dark:to-pink-900/88',
  midnight_purple:
    'bg-gradient-to-br from-purple-900/92 via-indigo-900/95 to-slate-900/95 dark:from-purple-950/97 dark:via-indigo-950/98 dark:to-slate-950/99',
  coral_reef:
    'bg-gradient-to-br from-red-700/85 via-orange-700/80 to-rose-800/85 dark:from-red-900/92 dark:via-orange-950/90 dark:to-rose-950/92',
  arctic_ice:
    'bg-gradient-to-br from-sky-300/75 via-blue-200/70 to-cyan-300/72 dark:from-sky-900/88 dark:via-blue-950/85 dark:to-cyan-950/88',

  // ── gradient sống động ──
  aurora:
    'bg-gradient-to-br from-teal-700/88 via-emerald-800/82 to-purple-700/88 dark:from-teal-950/95 dark:via-emerald-950/90 dark:to-purple-950/95',
  galaxy:
    'bg-gradient-to-br from-indigo-900/95 via-purple-900/92 to-slate-900/97 dark:from-indigo-950/98 dark:via-purple-950/96 dark:to-slate-950/99',
  fire_ice:
    'bg-gradient-to-br from-red-700/88 via-slate-800/85 to-blue-700/88 dark:from-red-900/93 dark:via-slate-950/95 dark:to-blue-900/93',
  tropical:
    'bg-gradient-to-br from-green-700/82 via-cyan-700/78 to-yellow-700/78 dark:from-green-900/90 dark:via-cyan-950/88 dark:to-yellow-900/88',
  candy:
    'bg-gradient-to-br from-pink-400/80 via-violet-400/75 to-cyan-400/78 dark:from-pink-900/90 dark:via-violet-950/88 dark:to-cyan-950/90',

  // ── tối giản ──
  pure_dark: 'bg-[#050507] dark:bg-[#030303]',
  soft_gray:
    'bg-gradient-to-br from-zinc-600/85 via-zinc-700/88 to-zinc-600/85 dark:from-zinc-800/93 dark:via-zinc-900/95 dark:to-zinc-800/93',
  warm_night:
    'bg-gradient-to-br from-zinc-900/92 via-purple-900/78 to-zinc-900/95 dark:from-zinc-950/97 dark:via-purple-950/85 dark:to-zinc-950/98',
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
