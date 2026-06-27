# Wallpaper Picker Redesign — More Themes + Messenger-style Layout

**Goal:** Replace the 5-preset circle grid with a Messenger-style two-panel dialog (list left,
live preview right), add 18 new themes organized into 3 categories, and group color presets
into a collapsible "Màu sắc đơn giản" section. Web and Flutter ship in the same commit.

**Constraints:**
- Do NOT change the `preset:<id>` wire format — backward compatible.
- Do NOT change `resolveWallpaper`, `splitFit`, `splitWallpaperLayout`, `splitWallpaperFit`
  or any image-upload / fit / scale logic — those already work.
- `WALLPAPER_EVENT` optimistic-apply flow stays intact.
- New preset keys must be added to BOTH `use-wallpaper.ts` (web) AND `chat_wallpaper_dialog.dart`
  (Flutter) so round-tripping is seamless.

---

## Task 1 — Add 18 new presets to `use-wallpaper.ts`

**File:** `apps/web/lib/hooks/use-wallpaper.ts`

### 1a — Extend `WALLPAPER_CLASSES`

Add the following entries to the `WALLPAPER_CLASSES` constant (after the existing 5 entries).
These classes render as the full-bleed chat background — keep opacity subtle so message text
remains readable:

```ts
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
```

### 1b — Extend `PRESET_TO_CLASS`

Add mappings for all 18 new preset IDs (the key after `preset:` → the key in WALLPAPER_CLASSES):

```ts
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
```

**Verify:** `pnpm build` passes with no TypeScript errors.

---

## Task 2 — Redesign `WallpaperPickerModal.tsx`

**File:** `apps/web/components/chat/WallpaperPickerModal.tsx`

Replace the current dialog with a Messenger-style two-panel layout:
- **Left panel:** scrollable theme list with category section headers
- **Right panel (sticky):** the live chat preview + image controls
- Dialog is wider: `sm:max-w-[680px]`
- On narrow viewports (`< sm`), panels stack vertically (preview on top)

### 2a — New THEME_CATEGORIES data structure

Replace the existing `PRESETS` array with this structure at the top of the file:

```tsx
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
      { value: 'preset:midnight_purple', label: 'Midnight Purple',  swatch: 'bg-gradient-to-br from-purple-900 to-indigo-950' },
      { value: 'preset:coral_reef',      label: 'Coral Reef',      swatch: 'bg-gradient-to-br from-red-500 to-orange-400' },
      { value: 'preset:arctic_ice',      label: 'Arctic Ice',      swatch: 'bg-gradient-to-br from-sky-200 to-blue-300' },
    ],
  },
  {
    id: 'vibrant',
    labelKey: 'wallpaperCategoryVibrant',
    icon: '✨',
    items: [
      { value: 'preset:aurora',   label: 'Aurora',    swatch: 'bg-gradient-to-br from-teal-500 via-emerald-600 to-purple-600' },
      { value: 'preset:galaxy',   label: 'Galaxy',    swatch: 'bg-gradient-to-br from-indigo-800 via-purple-800 to-slate-900' },
      { value: 'preset:fire_ice', label: 'Fire & Ice', swatch: 'bg-gradient-to-br from-red-500 to-blue-600' },
      { value: 'preset:tropical', label: 'Tropical',  swatch: 'bg-gradient-to-br from-green-500 via-cyan-500 to-yellow-400' },
      { value: 'preset:candy',    label: 'Candy',     swatch: 'bg-gradient-to-br from-pink-300 via-violet-400 to-cyan-300' },
    ],
  },
  {
    id: 'minimal',
    labelKey: 'wallpaperCategoryMinimal',
    icon: '⬛',
    items: [
      { value: 'preset:pure_dark',  label: 'Pure Dark',   swatch: 'bg-[#050507] border border-zinc-700' },
      { value: 'preset:soft_gray',  label: 'Soft Gray',   swatch: 'bg-zinc-500' },
      { value: 'preset:warm_night', label: 'Warm Night',  swatch: 'bg-gradient-to-br from-zinc-800 to-purple-950' },
    ],
  },
]
```

### 2b — New component structure

The component keeps ALL existing state (`selected`, `fit`, `scale`, `uploading`, `saving`) and
all existing handlers (`handleUpload`, `handleConfirm`, `initFromStorage`). Only the JSX
render changes.

Key state to add:
```tsx
const [colorsExpanded, setColorsExpanded] = useState(false)
```

Auto-expand if the currently selected preset is one of the "hidden" colors (index ≥ 5):
```tsx
// Inside initFromStorage, after setSelected(parsed.value):
const colorItems = THEME_CATEGORIES[0].items
const hiddenItems = colorItems.slice(5)
if (hiddenItems.some((i) => i.value === parsed.value)) {
  setColorsExpanded(true)
}
```

### 2c — Dialog JSX layout

```tsx
<Dialog open={open} onOpenChange={(o) => { if (o) initFromStorage(); else onClose() }}>
  <DialogContent className="max-w-sm sm:max-w-[680px] p-0 gap-0 overflow-hidden">
    <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
      <DialogTitle>{t('wallpaperPickerTitle')}</DialogTitle>
    </DialogHeader>
    <DialogA11yDescription />

    {/* Two-panel body */}
    <div className="flex flex-col sm:flex-row min-h-0" style={{ maxHeight: '60vh' }}>

      {/* LEFT: scrollable theme list */}
      <div className="w-full sm:w-56 border-b sm:border-b-0 sm:border-r border-border/50
                      overflow-y-auto flex-shrink-0">

        {/* Default item */}
        <button
          onClick={() => setSelected('')}
          className={cn(
            'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
            'hover:bg-muted/60',
            selected === '' && !isImage && 'bg-muted'
          )}
        >
          <div className="size-8 rounded-full flex items-center justify-center
                          bg-muted border border-muted-foreground/20 flex-shrink-0">
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
                      isSel && 'bg-muted'
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
                  className="flex items-center gap-1.5 w-full px-4 py-2 text-xs
                             text-pon-cyan hover:text-pon-cyan/80 transition-colors"
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
                  <div className="max-w-[70%] rounded-2xl rounded-tl-none bg-muted/90
                                  text-foreground border border-border/50 px-3 py-1.5 text-xs shadow-sm">
                    {t('inputPlaceholder')}
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[70%] rounded-2xl rounded-tr-none bg-primary
                                  text-primary-foreground px-3 py-1.5 text-xs shadow-sm">
                    👍
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[70%] rounded-2xl rounded-tl-none bg-muted/90
                                  text-foreground border border-border/50 px-3 py-1.5 text-xs shadow-sm">
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
```

**Remove:** the old `PRESETS` array, old `grid grid-cols-2 sm:grid-cols-3` preset grid,
the standalone upload Button, and the standalone image-fit section (all moved into the new layout above).

**Verify:** `pnpm build` passes. No TypeScript errors. ESLint passes.

---

## Task 3 — Add i18n keys

### Web — `apps/web/messages/en.json`

Add inside the `"chat"` namespace (near existing wallpaper keys):
```json
"wallpaperCategoryColors": "Simple Colors",
"wallpaperCategoryVibrant": "Vibrant Gradients",
"wallpaperCategoryMinimal": "Minimal",
"wallpaperShowMore": "Show more",
"wallpaperShowLess": "Show less"
```

### Web — `apps/web/messages/vi.json`

Add the same keys with Vietnamese values:
```json
"wallpaperCategoryColors": "Màu sắc đơn giản",
"wallpaperCategoryVibrant": "Gradient sống động",
"wallpaperCategoryMinimal": "Tối giản",
"wallpaperShowMore": "Xem thêm",
"wallpaperShowLess": "Ẩn bớt"
```

### Flutter — all 7 ARB files

Add to `app_en.arb`:
```json
"wallpaperCategoryColors": "Simple Colors",
"wallpaperCategoryVibrant": "Vibrant Gradients",
"wallpaperCategoryMinimal": "Minimal",
"wallpaperShowMore": "Show more",
"wallpaperShowLess": "Show less"
```

Add to `app_vi.arb`:
```json
"wallpaperCategoryColors": "Màu sắc đơn giản",
"wallpaperCategoryVibrant": "Gradient sống động",
"wallpaperCategoryMinimal": "Tối giản",
"wallpaperShowMore": "Xem thêm",
"wallpaperShowLess": "Ẩn bớt"
```

Add equivalent translations to `app_zh.arb`, `app_ja.arb`, `app_ko.arb`, `app_es.arb`,
`app_fr.arb` — translate from the English values.

---

## Task 4 — Flutter: add presets + redesign dialog

**File:** `apps/client/lib/features/chat/ui/widgets/chat_wallpaper_dialog.dart`

### 4a — New preset list

Replace the existing `presets` list inside `showWallpaperDialog` with the full set.
The structure is: `{ name, value, colors?, category }` where `category` is
`'colors'`, `'vibrant'`, or `'minimal'`.

```dart
// Helper type — add at top of file or as a typedef
typedef WallpaperPreset = Map<String, Object?>;

// Inside showWallpaperDialog:
final presets = <WallpaperPreset>[
  // ── Default ──
  {'name': context.l10n.wallpaperDefaultName, 'value': '', 'category': 'default'},

  // ── Màu sắc đơn giản ──
  {'name': 'Midnight Glow',   'value': 'preset:midnight_glow',   'category': 'colors',
   'colors': [const Color(0xFF0F0C20), const Color(0xFF15102A), const Color(0xFF050211)]},
  {'name': 'Neon Teal',       'value': 'preset:neon_teal',       'category': 'colors',
   'colors': [const Color(0xFF0A1F1D), const Color(0xFF081215), const Color(0xFF02070A)]},
  {'name': 'Sunset',          'value': 'preset:sunset',          'category': 'colors',
   'colors': [const Color(0xFF2C1619), const Color(0xFF1C0D1A), const Color(0xFF0F0611)]},
  {'name': 'Sweet Pink',      'value': 'preset:sweet_pink',      'category': 'colors',
   'colors': [const Color(0xFF2A1020), const Color(0xFF160A18), const Color(0xFF0C020A)]},
  {'name': 'Dark Shadow',     'value': 'preset:dark_shadow',     'category': 'colors',
   'colors': [const Color(0xFF121214), const Color(0xFF121214)]},
  {'name': 'Ocean Blue',      'value': 'preset:ocean_blue',      'category': 'colors',
   'colors': [const Color(0xFF0A1A35), const Color(0xFF051228), const Color(0xFF020A1A)]},
  {'name': 'Forest Green',    'value': 'preset:forest_green',    'category': 'colors',
   'colors': [const Color(0xFF0A1F0F), const Color(0xFF061408), const Color(0xFF020A04)]},
  {'name': 'Purple Haze',     'value': 'preset:purple_haze',     'category': 'colors',
   'colors': [const Color(0xFF1A0A2E), const Color(0xFF120620), const Color(0xFF0A0216)]},
  {'name': 'Warm Amber',      'value': 'preset:warm_amber',      'category': 'colors',
   'colors': [const Color(0xFF2A1A05), const Color(0xFF1A0F02), const Color(0xFF0F0801)]},
  {'name': 'Rose Gold',       'value': 'preset:rose_gold',       'category': 'colors',
   'colors': [const Color(0xFF2A0D1A), const Color(0xFF1A0810), const Color(0xFF2A1A08)]},
  {'name': 'Storm',           'value': 'preset:storm',           'category': 'colors',
   'colors': [const Color(0xFF0D1520), const Color(0xFF080E18), const Color(0xFF04080F)]},
  {'name': 'Cherry Blossom',  'value': 'preset:cherry_blossom',  'category': 'colors',
   'colors': [const Color(0xFF2A1020), const Color(0xFF200C18), const Color(0xFF180812)]},
  {'name': 'Midnight Purple', 'value': 'preset:midnight_purple', 'category': 'colors',
   'colors': [const Color(0xFF180528), const Color(0xFF100320), const Color(0xFF060118)]},
  {'name': 'Coral Reef',      'value': 'preset:coral_reef',      'category': 'colors',
   'colors': [const Color(0xFF2A0A0A), const Color(0xFF1A0605), const Color(0xFF180410)]},
  {'name': 'Arctic Ice',      'value': 'preset:arctic_ice',      'category': 'colors',
   'colors': [const Color(0xFF0A1A28), const Color(0xFF061220), const Color(0xFF040E1A)]},

  // ── Gradient sống động ──
  {'name': 'Aurora',    'value': 'preset:aurora',    'category': 'vibrant',
   'colors': [const Color(0xFF051A1A), const Color(0xFF061408), const Color(0xFF150820)]},
  {'name': 'Galaxy',    'value': 'preset:galaxy',    'category': 'vibrant',
   'colors': [const Color(0xFF0A0A28), const Color(0xFF100820), const Color(0xFF060610)]},
  {'name': 'Fire & Ice','value': 'preset:fire_ice',  'category': 'vibrant',
   'colors': [const Color(0xFF280A08), const Color(0xFF0F0F18), const Color(0xFF080A28)]},
  {'name': 'Tropical',  'value': 'preset:tropical',  'category': 'vibrant',
   'colors': [const Color(0xFF051A10), const Color(0xFF04141A), const Color(0xFF101205)]},
  {'name': 'Candy',     'value': 'preset:candy',     'category': 'vibrant',
   'colors': [const Color(0xFF200A20), const Color(0xFF180820), const Color(0xFF081820)]},

  // ── Tối giản ──
  {'name': 'Pure Dark',  'value': 'preset:pure_dark',  'category': 'minimal',
   'colors': [const Color(0xFF050507), const Color(0xFF030303)]},
  {'name': 'Soft Gray',  'value': 'preset:soft_gray',  'category': 'minimal',
   'colors': [const Color(0xFF2A2A2E), const Color(0xFF1E1E22), const Color(0xFF2A2A2E)]},
  {'name': 'Warm Night', 'value': 'preset:warm_night', 'category': 'minimal',
   'colors': [const Color(0xFF0F0F14), const Color(0xFF100518), const Color(0xFF0F0F14)]},
];
```

### 4b — Redesign `_WallpaperDialog` build method

Add state for collapsible colors section:
```dart
bool _colorsExpanded = false;
```

In `initState`, auto-expand if current selection is a hidden color:
```dart
const _hiddenColorValues = [
  'preset:ocean_blue', 'preset:forest_green', 'preset:purple_haze',
  'preset:warm_amber', 'preset:rose_gold', 'preset:storm',
  'preset:cherry_blossom', 'preset:midnight_purple', 'preset:coral_reef',
  'preset:arctic_ice',
];
if (_hiddenColorValues.contains(_selected)) {
  _colorsExpanded = true;
}
```

### 4c — New dialog layout

Replace `AlertDialog` with a `Dialog` that has a fixed max height.
Use a vertical layout (mobile-first): preview on top, scrollable list below.

```dart
Dialog(
  backgroundColor: AppTheme.darkSurface,
  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
  child: ConstrainedBox(
    constraints: const BoxConstraints(maxWidth: 360, maxHeight: 600),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Title bar
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 8, 0),
          child: Row(
            children: [
              Expanded(
                child: Text(context.l10n.changeChatThemeTitle,
                    style: const TextStyle(color: Colors.white, fontSize: 16,
                                          fontWeight: FontWeight.w600)),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.white54),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
        ),

        // Preview
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: _buildPreview(),
        ),

        const Divider(color: Colors.white12, height: 1),

        // Scrollable theme list
        Expanded(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 8),
            children: [
              // Default
              _buildThemeTile(
                preset: widget.presets.first,  // the '' default item
                icon: const Icon(Icons.block, color: Colors.white54, size: 20),
              ),
              const Divider(color: Colors.white12, height: 1),

              // Colors section
              _buildSectionHeader(context.l10n.wallpaperCategoryColors, '🎨'),
              ..._buildColorItems(),   // first 5 always shown; rest gated by _colorsExpanded
              _buildShowMoreButton(),

              const Divider(color: Colors.white12, height: 1),

              // Vibrant section
              _buildSectionHeader(context.l10n.wallpaperCategoryVibrant, '✨'),
              ...widget.presets
                  .where((p) => p['category'] == 'vibrant')
                  .map((p) => _buildThemeTile(preset: p)),

              const Divider(color: Colors.white12, height: 1),

              // Minimal section
              _buildSectionHeader(context.l10n.wallpaperCategoryMinimal, '⬛'),
              ...widget.presets
                  .where((p) => p['category'] == 'minimal')
                  .map((p) => _buildThemeTile(preset: p)),

              const Divider(color: Colors.white12, height: 1),

              // Upload
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: _uploading
                    ? const Center(child: CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation(AppTheme.ponCyan)))
                    : OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.ponCyan,
                          side: const BorderSide(color: AppTheme.ponCyan),
                        ),
                        icon: const Icon(Icons.add_photo_alternate_outlined),
                        label: Text(context.l10n.uploadImageButton),
                        onPressed: _uploadImage,
                      ),
              ),

              if (_isImage)
                WallpaperFitScaleSelector(
                  fit: _fit, scale: _scale,
                  onFitChanged: (v) => setState(() => _fit = v),
                  onScaleChanged: (v) => setState(() => _scale = v),
                ),
            ],
          ),
        ),

        // Actions
        const Divider(color: Colors.white12, height: 1),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(context.l10n.actionCancel,
                    style: const TextStyle(color: Colors.white54)),
              ),
              const SizedBox(width: 8),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppTheme.ponCyan),
                onPressed: _confirm,
                child: Text(context.l10n.actionConfirm,
                    style: const TextStyle(color: Colors.white)),
              ),
            ],
          ),
        ),
      ],
    ),
  ),
)
```

Helper methods to add to `_WallpaperDialogState`:

```dart
/// Section header row (emoji + label)
Widget _buildSectionHeader(String label, String emoji) {
  return Padding(
    padding: const EdgeInsets.fromLTRB(16, 10, 16, 2),
    child: Row(
      children: [
        Text(emoji, style: const TextStyle(fontSize: 13)),
        const SizedBox(width: 6),
        Text(label.toUpperCase(),
            style: const TextStyle(
                fontSize: 10, color: Colors.white38,
                fontWeight: FontWeight.w600, letterSpacing: 0.8)),
      ],
    ),
  );
}

/// Single theme list tile
Widget _buildThemeTile({required WallpaperPreset preset, Widget? icon}) {
  final val   = preset['value'] as String;
  final name  = preset['name'] as String;
  final colors = preset['colors'] as List<Color>?;
  final isSel  = !_isImage && _selected == val;

  return InkWell(
    onTap: () => setState(() => _selected = val),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: isSel ? AppTheme.ponCyan : Colors.white24,
                width: isSel ? 2.5 : 1.5,
              ),
              gradient: colors != null
                  ? LinearGradient(colors: colors,
                      begin: Alignment.topCenter, end: Alignment.bottomCenter)
                  : null,
              color: colors == null ? Colors.transparent : null,
            ),
            child: icon ?? (isSel
                ? const Icon(Icons.check, color: Colors.white, size: 18)
                : null),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(name,
              style: TextStyle(
                  color: isSel ? Colors.white : Colors.white70,
                  fontSize: 14))),
          if (isSel)
            const Icon(Icons.check_circle, color: AppTheme.ponCyan, size: 18),
        ],
      ),
    ),
  );
}

/// Color items with collapsible "show more"
List<Widget> _buildColorItems() {
  final colorItems = widget.presets
      .where((p) => p['category'] == 'colors')
      .toList();
  final visible = _colorsExpanded ? colorItems : colorItems.take(5).toList();
  return visible.map((p) => _buildThemeTile(preset: p)).toList();
}

/// "Xem thêm / Ẩn bớt" toggle button
Widget _buildShowMoreButton() {
  return TextButton(
    style: TextButton.styleFrom(foregroundColor: AppTheme.ponCyan),
    onPressed: () => setState(() => _colorsExpanded = !_colorsExpanded),
    child: Text(_colorsExpanded
        ? context.l10n.wallpaperShowLess
        : context.l10n.wallpaperShowMore),
  );
}
```

**Verify:** `flutter analyze` passes. `flutter build apk --debug` passes.

---

---

## Task 5 — Add "Chủ đề" category with real image wallpapers

**Context:** Tasks 1–4 only added CSS-gradient presets. This task adds a new category of
real-photo themed wallpapers using Unsplash CDN URLs. No backend changes needed —
`resolveWallpaper()` already handles raw HTTP image URLs (the non-`preset:` path in the function).
The stored value is just the full Unsplash URL with `#fit=cover` appended.

> **Important before implementing:** verify each Unsplash URL below loads a 200 OK in the browser.
> Replace any that 404 with a different Unsplash photo of the same theme.

### 5a — Define themed presets constant in `WallpaperPickerModal.tsx`

Add this constant **above** the existing `PRESETS` array:

```ts
const BASE = 'https://images.unsplash.com'

/** Image-based themed wallpapers. value = stored URL; thumb = swatch circle src. */
export const THEMED_PRESETS = [
  {
    value: `${BASE}/photo-1448375240586-882707db888b?w=1920&q=85&auto=format&fit=crop#fit=cover`,
    thumb: `${BASE}/photo-1448375240586-882707db888b?w=80&h=80&auto=format&fit=crop&crop=center`,
    label: 'wallpaperThemeForest',
  },
  {
    value: `${BASE}/photo-1505118380757-91f5f5632de0?w=1920&q=85&auto=format&fit=crop#fit=cover`,
    thumb: `${BASE}/photo-1505118380757-91f5f5632de0?w=80&h=80&auto=format&fit=crop&crop=center`,
    label: 'wallpaperThemeOcean',
  },
  {
    value: `${BASE}/photo-1464822759023-fed622ff2c3b?w=1920&q=85&auto=format&fit=crop#fit=cover`,
    thumb: `${BASE}/photo-1464822759023-fed622ff2c3b?w=80&h=80&auto=format&fit=crop&crop=center`,
    label: 'wallpaperThemeMountain',
  },
  {
    value: `${BASE}/photo-1522383225653-ed111181a951?w=1920&q=85&auto=format&fit=crop#fit=cover`,
    thumb: `${BASE}/photo-1522383225653-ed111181a951?w=80&h=80&auto=format&fit=crop&crop=center`,
    label: 'wallpaperThemeCherryBlossom',
  },
  {
    value: `${BASE}/photo-1462331940025-496dfbfc7564?w=1920&q=85&auto=format&fit=crop#fit=cover`,
    thumb: `${BASE}/photo-1462331940025-496dfbfc7564?w=80&h=80&auto=format&fit=crop&crop=center`,
    label: 'wallpaperThemeSpace',
  },
  {
    value: `${BASE}/photo-1531366936337-7c912a4589a7?w=1920&q=85&auto=format&fit=crop#fit=cover`,
    thumb: `${BASE}/photo-1531366936337-7c912a4589a7?w=80&h=80&auto=format&fit=crop&crop=center`,
    label: 'wallpaperThemeAurora',
  },
  {
    value: `${BASE}/photo-1477959858617-67f85cf4f1df?w=1920&q=85&auto=format&fit=crop#fit=cover`,
    thumb: `${BASE}/photo-1477959858617-67f85cf4f1df?w=80&h=80&auto=format&fit=crop&crop=center`,
    label: 'wallpaperThemeCityNight',
  },
  {
    value: `${BASE}/photo-1509316785289-025f5b846b35?w=1920&q=85&auto=format&fit=crop#fit=cover`,
    thumb: `${BASE}/photo-1509316785289-025f5b846b35?w=80&h=80&auto=format&fit=crop&crop=center`,
    label: 'wallpaperThemeDesert',
  },
]
```

### 5b — Add "Chủ đề" section to the left panel in `WallpaperPickerModal.tsx`

Inside the left panel list (below the Default item and above the "Màu sắc" section header),
insert a new "Chủ đề" section:

```tsx
{/* ── Chủ đề (themed photos) ── */}
<div className="px-3 pt-3 pb-1">
  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
    <span>🌄</span> {t('wallpaperCategoryThemes')}
  </p>
</div>
{THEMED_PRESETS.map((p) => {
  const label = t(p.label as any)
  const isSelected = selected === p.value
  return (
    <button
      key={p.value}
      onClick={() => handleSelect(p.value)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
        isSelected
          ? 'bg-white/10 text-foreground'
          : 'hover:bg-white/5 text-muted-foreground hover:text-foreground',
      )}
    >
      {/* Circular image swatch */}
      <div
        className={cn(
          'size-9 rounded-full shrink-0 bg-cover bg-center border-2 transition-colors',
          isSelected ? 'border-pon-cyan' : 'border-white/20',
        )}
        style={{ backgroundImage: `url(${p.thumb})` }}
      />
      <span className="flex-1 text-sm">{label}</span>
      {isSelected && (
        <Check className="size-4 text-pon-cyan shrink-0" />
      )}
    </button>
  )
})}
<div className="mx-3 my-1 h-px bg-white/10" />
```

**Note:** `selected` is the existing state variable in `WallpaperPickerModal.tsx` that holds the
current wallpaper value. `handleSelect(value)` is the existing handler that fires the
`WALLPAPER_EVENT` and sets local state. Use whatever the existing variable/handler names are —
adapt as needed.

### 5c — Preview panel: handle image themes

In the right-panel preview div, the existing code should already show image wallpapers correctly
because it uses `resolvedPreview` from `resolveWallpaper(selected)` which already returns
`style.backgroundImage` for HTTP URLs. No change needed here — just verify visually.

If the preview div uses a `className` prop only (not `style`), update it to also accept `style`:
```tsx
<div
  className={cn('...preview classes...', resolvedPreview.className)}
  style={resolvedPreview.style}
/>
```

### 5d — i18n keys for themes

Add to `apps/web/messages/en.json` (inside the `wallpaper` namespace, or wherever the other
wallpaper keys live):

```json
"wallpaperCategoryThemes": "Themes",
"wallpaperThemeForest": "Forest",
"wallpaperThemeOcean": "Ocean",
"wallpaperThemeMountain": "Snow Mountain",
"wallpaperThemeCherryBlossom": "Cherry Blossom",
"wallpaperThemeSpace": "Space",
"wallpaperThemeAurora": "Northern Lights",
"wallpaperThemeCityNight": "City Night",
"wallpaperThemeDesert": "Desert"
```

Add Vietnamese equivalents to `apps/web/messages/vi.json`:
```json
"wallpaperCategoryThemes": "Chủ đề",
"wallpaperThemeForest": "Rừng",
"wallpaperThemeOcean": "Đại dương",
"wallpaperThemeMountain": "Núi tuyết",
"wallpaperThemeCherryBlossom": "Hoa anh đào",
"wallpaperThemeSpace": "Vũ trụ",
"wallpaperThemeAurora": "Bắc cực quang",
"wallpaperThemeCityNight": "Thành phố đêm",
"wallpaperThemeDesert": "Sa mạc"
```

Add best-effort translations to the remaining language files.

### 5e — Flutter: add themed presets

**File:** `apps/client/lib/features/chat/ui/widgets/chat_wallpaper_dialog.dart`

Add the themed presets to the `presets` list (after the minimal section and before the upload button logic).
Add a new `category: 'themes'` for them:

```dart
// ── Chủ đề (themed photos) ──
const _unsplashBase = 'https://images.unsplash.com';
const _themed = [
  ('wallpaperThemeForest',        'photo-1448375240586-882707db888b'),
  ('wallpaperThemeOcean',         'photo-1505118380757-91f5f5632de0'),
  ('wallpaperThemeMountain',      'photo-1464822759023-fed622ff2c3b'),
  ('wallpaperThemeCherryBlossom', 'photo-1522383225653-ed111181a951'),
  ('wallpaperThemeSpace',         'photo-1462331940025-496dfbfc7564'),
  ('wallpaperThemeAurora',        'photo-1531366936337-7c912a4589a7'),
  ('wallpaperThemeCityNight',     'photo-1477959858617-67f85cf4f1df'),
  ('wallpaperThemeDesert',        'photo-1509316785289-025f5b846b35'),
];

for (final (labelKey, photoId) in _themed) {
  presets.add({
    'name':     AppLocalizations.of(context)!.translate(labelKey),
    'value':    '$_unsplashBase/$photoId?w=1920&q=85&auto=format&fit=crop#fit=cover',
    'imageUrl': '$_unsplashBase/$photoId?w=80&h=80&auto=format&fit=crop&crop=center',
    'category': 'themes',
  });
}
```

**Note:** Use whatever the project's i18n lookup pattern is (may be `context.l10n.wallpaperThemeForest`
instead of `translate(labelKey)`) — adapt to match the existing i18n pattern in the Flutter project.

In `_buildThemeTile`, handle the `imageUrl` field alongside `colors`:

```dart
Widget _buildThemeTile({required WallpaperPreset preset, Widget? icon}) {
  final val      = preset['value'] as String;
  final name     = preset['name'] as String;
  final colors   = preset['colors'] as List<Color>?;
  final imageUrl = preset['imageUrl'] as String?;
  final isSel    = !_isImage && _selected == val;

  // Swatch decoration
  DecorationImage? decoImage;
  LinearGradient? decoGradient;
  if (imageUrl != null) {
    decoImage = DecorationImage(
      image: NetworkImage(imageUrl),
      fit: BoxFit.cover,
    );
  } else if (colors != null) {
    decoGradient = LinearGradient(
      colors: colors,
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
    );
  }

  return InkWell(
    onTap: () => setState(() => _selected = val),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: isSel ? AppTheme.ponCyan : Colors.white24,
                width: isSel ? 2.5 : 1.5,
              ),
              gradient: decoGradient,
              image: decoImage,
              color: (decoGradient == null && decoImage == null) ? Colors.transparent : null,
            ),
            child: icon ?? (isSel
                ? const Icon(Icons.check, color: Colors.white, size: 18)
                : null),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(name,
              style: TextStyle(
                  color: isSel ? Colors.white : Colors.white70,
                  fontSize: 14))),
          if (isSel)
            const Icon(Icons.check_circle, color: AppTheme.ponCyan, size: 18),
        ],
      ),
    ),
  );
}
```

In the dialog's ListView, insert the "Chủ đề" section before the upload button
(mirroring the web layout — after Tối giản):

```dart
const Divider(color: Colors.white12, height: 1),
_buildSectionHeader(context.l10n.wallpaperCategoryThemes, '🌄'),
...widget.presets
    .where((p) => p['category'] == 'themes')
    .map((p) => _buildThemeTile(preset: p)),
```

### 5f — Flutter ARB keys

Add to all ARB files (`app_en.arb`, `app_vi.arb`, etc.) the same keys from step 5d.

`app_en.arb`:
```json
"wallpaperCategoryThemes": "Themes",
"wallpaperThemeForest": "Forest",
"wallpaperThemeOcean": "Ocean",
"wallpaperThemeMountain": "Snow Mountain",
"wallpaperThemeCherryBlossom": "Cherry Blossom",
"wallpaperThemeSpace": "Space",
"wallpaperThemeAurora": "Northern Lights",
"wallpaperThemeCityNight": "City Night",
"wallpaperThemeDesert": "Desert"
```

`app_vi.arb`:
```json
"wallpaperCategoryThemes": "Chủ đề",
"wallpaperThemeForest": "Rừng",
"wallpaperThemeOcean": "Đại dương",
"wallpaperThemeMountain": "Núi tuyết",
"wallpaperThemeCherryBlossom": "Hoa anh đào",
"wallpaperThemeSpace": "Vũ trụ",
"wallpaperThemeAurora": "Bắc cực quang",
"wallpaperThemeCityNight": "Thành phố đêm",
"wallpaperThemeDesert": "Sa mạc"
```

---

## Manual verification

1. Open PON Web. Open any conversation → Wallpaper picker.
2. Confirm layout: theme list on left, preview on right (or stacked on mobile).
3. "Simple Colors" section shows 5 themes → click "Show more" → 10 more appear.
4. Select a theme from each category (Colors, Vibrant, Minimal) — preview updates instantly.
5. Select Default — chat background resets.
6. Upload a custom image — fit/scale controls appear. Apply → wallpaper shows in chat.
7. Rapid-switch conversations — wallpaper switches correctly (existing optimistic-apply logic).
8. Open Flutter app → same conversation → wallpaper matches web selection.
9. Open Flutter wallpaper dialog → same categories/themes present → works as expected.
10. Old conversations saved with `preset:midnight_glow` etc. still resolve correctly (backward compat).
