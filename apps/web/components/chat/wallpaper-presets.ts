// Wallpaper preset catalogue + parsing helpers extracted from
// WallpaperPickerModal.tsx. Theme catalogue mirrors Flutter
// chat_wallpaper_dialog.dart exactly (values + names). Categories group the
// presets in the picker; the `preset:<id>` wire format is unchanged so old
// conversations round-trip.

export type ThemeItem = { value: string; label: string; swatch: string }
export type ThemeCategory = {
  id: string
  labelKey: string   // key into t('...')
  icon: string       // emoji shown in section header
  items: ThemeItem[]
  collapsible?: boolean   // if true, show only first 5 then a toggle
}

export const THEME_CATEGORIES: ThemeCategory[] = [
  {
    id: 'colors',
    labelKey: 'wallpaperCategoryColors',
    icon: '🎨',
    collapsible: true,
    items: [
      { value: 'preset:midnight_glow',   label: 'wallpaperPresetMidnightGlow',   swatch: 'bg-gradient-to-br from-indigo-900 to-slate-950' },
      { value: 'preset:neon_teal',       label: 'wallpaperPresetNeonTeal',       swatch: 'bg-gradient-to-br from-teal-900 to-cyan-800' },
      { value: 'preset:sunset',          label: 'wallpaperPresetSunset',          swatch: 'bg-gradient-to-br from-orange-400 to-purple-600' },
      { value: 'preset:sweet_pink',      label: 'wallpaperPresetSweetPink',      swatch: 'bg-gradient-to-br from-pink-300 to-red-400' },
      { value: 'preset:dark_shadow',     label: 'wallpaperPresetDarkShadow',     swatch: 'bg-gradient-to-br from-zinc-800 to-zinc-950' },
      // ↑ first 5 shown by default when collapsible; below hidden until "xem thêm"
      { value: 'preset:ocean_blue',      label: 'wallpaperPresetOceanBlue',      swatch: 'bg-gradient-to-br from-blue-700 to-sky-500' },
      { value: 'preset:forest_green',    label: 'wallpaperPresetForestGreen',    swatch: 'bg-gradient-to-br from-green-800 to-emerald-600' },
      { value: 'preset:purple_haze',     label: 'wallpaperPresetPurpleHaze',     swatch: 'bg-gradient-to-br from-purple-700 to-fuchsia-600' },
      { value: 'preset:warm_amber',      label: 'wallpaperPresetWarmAmber',      swatch: 'bg-gradient-to-br from-amber-600 to-orange-500' },
      { value: 'preset:rose_gold',       label: 'wallpaperPresetRoseGold',       swatch: 'bg-gradient-to-br from-rose-400 to-amber-300' },
      { value: 'preset:storm',           label: 'wallpaperPresetStorm',           swatch: 'bg-gradient-to-br from-slate-700 to-blue-900' },
      { value: 'preset:cherry_blossom',  label: 'wallpaperPresetCherryBlossom',  swatch: 'bg-gradient-to-br from-pink-300 to-rose-300' },
      { value: 'preset:midnight_purple', label: 'wallpaperPresetMidnightPurple', swatch: 'bg-gradient-to-br from-purple-900 to-indigo-950' },
      { value: 'preset:coral_reef',      label: 'wallpaperPresetCoralReef',      swatch: 'bg-gradient-to-br from-red-500 to-orange-400' },
      { value: 'preset:arctic_ice',      label: 'wallpaperPresetArcticIce',      swatch: 'bg-gradient-to-br from-sky-200 to-blue-300' },
    ],
  },
  {
    id: 'vibrant',
    labelKey: 'wallpaperCategoryVibrant',
    icon: '✨',
    items: [
      { value: 'preset:aurora',   label: 'wallpaperPresetAurora',     swatch: 'bg-gradient-to-br from-teal-500 via-emerald-600 to-purple-600' },
      { value: 'preset:galaxy',   label: 'wallpaperPresetGalaxy',     swatch: 'bg-gradient-to-br from-indigo-800 via-purple-800 to-slate-900' },
      { value: 'preset:fire_ice', label: 'wallpaperPresetFireIce', swatch: 'bg-gradient-to-br from-red-500 to-blue-600' },
      { value: 'preset:tropical', label: 'wallpaperPresetTropical',   swatch: 'bg-gradient-to-br from-green-500 via-cyan-500 to-yellow-400' },
      { value: 'preset:candy',    label: 'wallpaperPresetCandy',      swatch: 'bg-gradient-to-br from-pink-300 via-violet-400 to-cyan-300' },
    ],
  },
  {
    id: 'minimal',
    labelKey: 'wallpaperCategoryMinimal',
    icon: '⬛',
    items: [
      { value: 'preset:pure_dark',  label: 'wallpaperPresetPureDark',  swatch: 'bg-[#050507] border border-zinc-700' },
      { value: 'preset:soft_gray',  label: 'wallpaperPresetSoftGray',  swatch: 'bg-zinc-500' },
      { value: 'preset:warm_night', label: 'wallpaperPresetWarmNight', swatch: 'bg-gradient-to-br from-zinc-800 to-purple-950' },
    ],
  },
]

// Image-based themed wallpapers (the "Chủ đề" category). Mirrors the Flutter
// `chat_wallpaper_dialog.dart` `themes` category exactly. `value` = the stored
// wallpaper string; `thumb` = the small circular swatch source.
//
// The stored `value` is the RAW Unsplash URL with NO `#fit=` suffix: both
// `resolveWallpaper` and `splitFit` default a hash-less image URL to `cover`,
// and both STRIP the `#fit=` suffix when reloading a stored value — so the
// canonical compared value must itself be hash-less for the selected theme to
// keep highlighting on reopen and to round-trip identically with Flutter.
const UNSPLASH_BASE = 'https://images.unsplash.com'
export const THEMED_PRESETS: { value: string; thumb: string; label: string }[] = [
  { value: `${UNSPLASH_BASE}/photo-1448375240586-882707db888b?w=1920&q=85&auto=format&fit=crop`, thumb: `${UNSPLASH_BASE}/photo-1448375240586-882707db888b?w=80&h=80&auto=format&fit=crop&crop=center`, label: 'wallpaperThemeForest' },
  { value: `${UNSPLASH_BASE}/photo-1505118380757-91f5f5632de0?w=1920&q=85&auto=format&fit=crop`, thumb: `${UNSPLASH_BASE}/photo-1505118380757-91f5f5632de0?w=80&h=80&auto=format&fit=crop&crop=center`, label: 'wallpaperThemeOcean' },
  { value: `${UNSPLASH_BASE}/photo-1464822759023-fed622ff2c3b?w=1920&q=85&auto=format&fit=crop`, thumb: `${UNSPLASH_BASE}/photo-1464822759023-fed622ff2c3b?w=80&h=80&auto=format&fit=crop&crop=center`, label: 'wallpaperThemeMountain' },
  { value: `${UNSPLASH_BASE}/photo-1522383225653-ed111181a951?w=1920&q=85&auto=format&fit=crop`, thumb: `${UNSPLASH_BASE}/photo-1522383225653-ed111181a951?w=80&h=80&auto=format&fit=crop&crop=center`, label: 'wallpaperThemeCherryBlossom' },
  { value: `${UNSPLASH_BASE}/photo-1462331940025-496dfbfc7564?w=1920&q=85&auto=format&fit=crop`, thumb: `${UNSPLASH_BASE}/photo-1462331940025-496dfbfc7564?w=80&h=80&auto=format&fit=crop&crop=center`, label: 'wallpaperThemeSpace' },
  { value: `${UNSPLASH_BASE}/photo-1531366936337-7c912a4589a7?w=1920&q=85&auto=format&fit=crop`, thumb: `${UNSPLASH_BASE}/photo-1531366936337-7c912a4589a7?w=80&h=80&auto=format&fit=crop&crop=center`, label: 'wallpaperThemeAurora' },
  { value: `${UNSPLASH_BASE}/photo-1477959858617-67f85cf4f1df?w=1920&q=85&auto=format&fit=crop`, thumb: `${UNSPLASH_BASE}/photo-1477959858617-67f85cf4f1df?w=80&h=80&auto=format&fit=crop&crop=center`, label: 'wallpaperThemeCityNight' },
  { value: `${UNSPLASH_BASE}/photo-1509316785289-025f5b846b35?w=1920&q=85&auto=format&fit=crop`, thumb: `${UNSPLASH_BASE}/photo-1509316785289-025f5b846b35?w=80&h=80&auto=format&fit=crop&crop=center`, label: 'wallpaperThemeDesert' },
]

export const FIT_OPTIONS = ['cover', 'contain', 'fill'] as const
export type Fit = (typeof FIT_OPTIONS)[number]

// Parse the stored value `<url>#fit=<fit>&scale=<n>` into its parts. Backward
// compatible with `#fit=` only and bare preset/flat keys (Flutter ignores the
// `&scale=` suffix — it reads the URL before `#`).
export function splitFit(raw: string): { value: string; fit: Fit; scale: number } {
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
