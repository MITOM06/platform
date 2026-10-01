# PON Design System — "Warm Grey & Burgundy"

> **The web app is the source of truth.** Every value below is read from the
> running web code (`apps/web/app/globals.css`, `apps/web/components/ui/*`,
> `apps/web/components/chat/*`). Flutter (`apps/client`) implements the same
> system; what still differs is listed in [§10 Mobile sync status](#10-mobile-sync-status).
>
> Last verified against code: **2026-10-01**. How we got to this direction:
> [`superpowers/UI-REDESIGN-DIRECTION.md`](superpowers/UI-REDESIGN-DIRECTION.md) (history only).

PON is a self-hosted B2B assistant platform — RBAC, SSO, audit log, admin console. The UI
has to read as a calm professional tool, not a consumer chat app. That is why there is
one accent, no gradients, no glow, and hierarchy comes from weight and shade.

## 1. Principles

1. **One accent.** Burgundy means "this is the primary action" (buttons, links, focus,
   active/selected state). It never decorates neutral content. No second accent hue.
2. **Weight and shade before colour.** Show importance with 400 / 500 / 600 and with
   `foreground` → `muted-foreground`, not with a new colour.
3. **Borders, not shadows.** In-flow surfaces are separated by a 1px hairline and a step
   in background shade (`background` → `card` → `accent`). Only floating layers
   (dialog, popover, menu, sheet) may carry a shadow.
4. **No gradients, no blur.** Flat fills only. The single exception is user-selectable
   chat wallpapers, which are content, not chrome.
5. **Warm neutrals.** Never pure `#000` / `#FFF` for text or page background, and never a
   white/black alpha tint for text — use the tokens.
6. **Both themes are first-class.** Every colour comes from a token that has a light and
   a dark value. A literal hex in a component is a bug.

## 2. Colour

Tokens live in `apps/web/app/globals.css` (`:root` and `.dark`) and are exposed to
Tailwind as `bg-*` / `text-*` / `border-*`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F5F2ED` | `#1A1614` | Page |
| `card` / `popover` | `#FFFFFF` | `#221D1A` | Raised surface, menus, dialogs |
| `foreground` | `#241F1D` | `#F3EEE8` | Primary text |
| `muted-foreground` | `#6B6259` | `#B0A79C` | Secondary text, placeholders, icons at rest |
| `secondary` / `muted` | `#EFEAE3` | `#2C2521` | Quiet fill: incoming bubble, tab track, secondary button |
| `border` | `#DDD8D0` | `#332B27` | 1px hairline |
| `input` | `#FFFFFF` | `#221D1A` | Field fill |
| `primary` / `ring` | `#7A2E3A` | `#A8475A` | The accent |
| `primary-foreground` | `#FFFFFF` | `#F3EEE8` | Text/icon on the accent |
| `accent` | `#F1E4E6` | `#3A2A2C` | Accent tint: selected row, hover, badge fill |
| `accent-foreground` | `#7A2E3A` | `#E8B4BE` | Text/icon on the tint |
| `destructive` | `#B3261E` | `#E5484D` | Delete, errors. Never burgundy |
| `sidebar` | `#EFEAE3` | `#151110` | Navigation rail / conversation list |
| `online-green` | `#00E676` | `#00E676` | Presence dot only |

Structural dividers (sidebar edge, headers) use the border at 60% (`border-border/60`).

**Contrast (WCAG):** text on page 14.6 (light) / 15.6 (dark); secondary text 5.3 / 7.6;
white on accent 9.2 / 4.9; accent-foreground on tint 7.4 / 7.6. The dark accent on the
dark page is only 3.2 — use it for fills and large glyphs, and use `accent-foreground`
(`#E8B4BE`) for burgundy-coloured **text** in dark mode.

Semantic colours outside the accent: success/presence green, destructive red, warning
amber, and third-party brand colours inside their own logo. Nothing else.

Default theme: **dark**, with system detection and a user toggle (`next-themes`,
`defaultTheme="dark"`, `enableSystem`).

## 3. Typography

- **Typeface:** Geist (sans) for everything; Geist Mono for code, ids, tokens, audit
  action codes. Loaded with `next/font` in `apps/web/app/layout.tsx`.
- **Weights:** 400 body, 500 labels/controls, 600 headings and emphasis. 700 is reserved
  for a page's single top-level title and numeric highlights.

| Role | Size / line | Weight | Tailwind |
|---|---|---|---|
| Page title | 24 / 32 | 600 | `text-2xl font-semibold` |
| Section title | 18–20 / 28 | 600 | `text-lg` / `text-xl font-semibold` |
| Card / dialog title | 16 / 24 | 600 | `text-base font-semibold` |
| Body, controls, chat message | 14 / 20 | 400–500 | `text-sm` |
| Meta, helper, secondary | 12 / 16 | 400–500 | `text-xs` |
| Micro: timestamps, badge counts | 10–11 | 500 | `text-[10px]` / `text-[11px]` |
| Auth hero | 30–36 | 600 | `text-3xl` / `text-4xl tracking-tight` |

`text-sm` (14px) is the default — nearly half of all type on web. Inputs are 16px on phones
(`text-base md:text-sm`) so iOS does not zoom on focus. Group labels above lists use
`text-xs font-medium uppercase tracking-wide text-muted-foreground`; do not uppercase
anything else. Headlines get `tracking-tight`.

## 4. Shape

`--radius: 0.75rem` drives one scale:

| Token | px | Use |
|---|---|---|
| `rounded-sm` | 8 | Chips, small tags, inner elements |
| `rounded-md` | 10 | Buttons, inputs, selects, menu items |
| `rounded-lg` | 12 | Dialogs, list rows, tab track |
| `rounded-xl` | 16 | Cards and large panels |
| `rounded-t-2xl` | 16 | Bottom-sheet top corners (phone) |
| `rounded-full` | — | Avatars, badges, switches, icon buttons |

**Chat bubble:** 14px, with the corner nearest the sender flattened to 4px
(`rounded-[14px] rounded-tr-[4px]` for mine, `rounded-tl-[4px]` for theirs). Media inside
a bubble is clipped to the same 14px.

**Elevation:** hairline + shade for anything in the page flow. Floating layers keep the
shadcn shadow (`shadow-md` menus/popovers, `shadow-lg` dialogs/sheets) plus their border.
Domain components must not add `shadow-*` — today there are none outside `components/ui`.

## 5. Spacing and layout

4px grid (Tailwind spacing). Common steps: 4, 8, 12, 16, 24.

| Element | Value |
|---|---|
| Control height | 24 `xs` · 32 `sm` · **36 default** · 40 `lg` |
| Touch target on phones | min 44 × 44 (`tap` utility) |
| Field / button inline padding | 12 (input) · 16 (button) |
| Chat header | 56 high |
| Sidebar header, mobile tab bar | 64 high (+ bottom safe-area) |
| Sidebar width | 288 default, resizable, min 240, max 80% of viewport |
| Chat bubble | max 70% of the thread; AI replies cap at 640px on `lg` |
| Bubble padding | 16 × 10 |
| Avatar | 24 inline · 32 message · 40 list · 80 profile |

Breakpoints: `sm` 640, **`md` 768 = the phone ↔ desktop switch** (sidebar appears, tab bar
disappears), `lg` 1024. Design phone-first; add `md:` for the two-pane layout. On phones
dialogs become bottom sheets (`ResponsiveModal`), and fixed bars add
`env(safe-area-inset-*)`.

## 6. Components

All primitives are shadcn/ui in `apps/web/components/ui/` (Radix). Do not hand-edit them;
theme them through tokens.

| Component | Spec |
|---|---|
| **Button** | `default` accent fill / white text · `secondary` muted fill · `outline` border on `background` · `ghost` no fill, tint on hover · `destructive` red fill · `link`. 14px / 500, 10px radius, icon 16px with 8px gap. One `default` button per view. |
| **Input / Textarea / Select** | 36 high, 10px radius, 1px `border`, transparent on card. Focus: border becomes `ring` + 3px ring at 50%. Error: `destructive` border + ring. Placeholder `muted-foreground`. |
| **Badge** | Pill, 12px / 500. `default` accent, `secondary` muted, `outline`, `destructive`. Unread counts use `default`. |
| **Tabs** | `muted` track 36 high, 12px radius; active tab is a `background` pill. |
| **Switch** | 32 × 18 pill; on = accent, off = `input`. |
| **Card** | `card` fill, 1px border, 16px radius, 24px padding. |
| **List row** | 12px radius, 12px padding. Rest transparent; hover `muted`; selected = `primary` at 8% plus a 2px accent bar on the leading edge. |
| **Dialog / Sheet** | `popover` fill, border, 12px radius, 24px padding, max 512 wide; on phones a bottom sheet with 16px top corners. Title 16 / 600, description 14 `muted-foreground`. |
| **Chat bubble — mine** | Accent fill, `primary-foreground` text, border `primary/30`. |
| **Chat bubble — theirs / AI** | `muted/70` fill, `foreground` text, border `border/50`. AI replies add source chips and a trace panel below. |
| **Avatar** | Circle; fallback initials on `primary` at 10% in accent text. Presence dot 10px `online-green` with a 2px `background` ring, bottom-right. |
| **Toast** | `sonner`; text only, localized, never raw backend errors (see `.claude/rules/no-raw-system-data-in-ui.md`). |

## 7. Icons

Web: **lucide-react**, 16px by default, 14px in dense rows, 20px in navigation, `currentColor`, default
stroke. Icons take the text colour of their context — `muted-foreground` at rest,
`foreground` or `primary` when active. Never tint an icon with a decorative colour.

Flutter uses Material Symbols **Rounded** as the platform equivalent (same weight and
roundness). Keep the pairing rule: the "off" state is the outlined glyph, "on" is filled.

## 8. Motion

Subtle and functional. Tokens are identical on both platforms
(`globals.css` ↔ `apps/client/lib/core/theme/motion.dart`).

| Token | Duration | Use |
|---|---|---|
| instant | 100ms | Press feedback |
| fast | 180ms | Reaction / send pop |
| base | 260ms | Element entrance, page slide |
| slow | 420ms | Large surfaces |
| ambient | 2800ms | Assistant-avatar sheen only |

Easing: `settle` `cubic-bezier(.22,1,.36,1)` for entrances, `standard`
`cubic-bezier(.4,0,.2,1)`, `pop` `cubic-bezier(.34,1.56,.64,1)` for confirmations. Lists
stagger by 60ms, capped at 6 items. Everything is disabled under
`prefers-reduced-motion` / `MediaQuery.disableAnimations`.

## 9. Content

- Seven languages (en, vi, zh, ja, ko, es, fr); no hardcoded UI strings
  (`.claude/rules/i18n.md`).
- Sentence case. A button names its action ("Save changes"), and the toast repeats it
  ("Changes saved").
- Never show ids, URLs, JSON or backend error text
  (`.claude/rules/no-raw-system-data-in-ui.md`).

## 10. Mobile sync status

The Flutter client was brought onto this system on 2026-10-01
(`feat/mobile-design-sync`). What changed, and what still differs:

**Now in sync**

| Area | Before | Now |
|---|---|---|
| Accent | A third burgundy `#96435B` at 356 call sites, same in both modes | `AppTheme.accent(context)` → `#7A2E3A` / `#A8475A`; the constant is deleted |
| Typeface | System font (Roboto / SF), generic `monospace` | Geist + Geist Mono bundled (`assets/fonts`, OFL) |
| Weights | `bold` was the most used weight | 400 / 500 / 600 only (the PON wordmark is the one exception) |
| Type scale | 13, 15 and half sizes | 10 · 11 · 12 · 14 · 16 · 18 · 20 · 24 |
| Buttons | ~56 high, 16 / 700, letter-spacing 0.5, ALL-CAPS labels | 44 high, 14 / 600, sentence case (`Sign In`, `Đăng nhập`) |
| Outlined / secondary buttons, chips, tabs, switches, snackbars, menus | Material's pill-shaped defaults | Themed in `pon_component_themes.dart` to match `components/ui` |
| Inputs | 1.5px border, 2px focus, 24 × 18 padding, white/black alpha hints | 1px border, 1.5px accent focus, 14 × 13 padding, `muted-foreground` hints |
| Colour scheme | Unset roles fell back to Material teal (selected segmented button) | Every role spelled out from the palette |
| Chat bubbles | Incoming on white, AI on the accent tint, bottom corner flattened, own timestamp unreadable | Incoming and AI on `muted` at 70%, top sender corner 4px, timestamp on-accent at 70% |
| Inline code | Accent text on the muted-text colour; fell back to a proportional font | Geist Mono on the `muted` fill |
| Light mode | PON AI tile, meeting-summary card and avatar rings used dark-only constants | Theme-aware resolvers |
| Errors | About 20 places printed the raw exception (`Bad state: not-authenticated`) | `friendlyError()` everywhere |
| Help / legal | Questions and section titles in the accent | Foreground text, as on web |
| Bottom tab bar | 56 high, 10px labels, one label truncated | 64 high, 12 / 500, page colour, hairline (web `MobileTabBar`) |

`test/core/design_system_sync_test.dart` fails if any of these regress.

**Still different — needs a product decision, not a style fix**

| Area | Web | Mobile | Note |
|---|---|---|---|
| Bottom navigation | Chat · Friends · Explore · Settings | Chats · Archived · Requests · New; the rest sits in the header | Information architecture, not styling |
| Card radius | 16 (`rounded-xl`) | 12 (`AppTheme.radiusCard`) | `PonCard` also draws list rows, where 12 is right |
| Bubble width | max 70% | max 82% | Deliberate on a narrow screen |
| Icons | lucide | Material Symbols Rounded | Accepted platform mapping (§7) |

**Not yet reviewed with real data:** conversation list rows, the chat composer and header,
group info, admin panels, the call screens. Their chrome is on the tokens, but spacing inside
data-driven lists has only been seen in loading and empty states.

**Reviewing the mobile UI.** `DESIGN_SHOTS=1 flutter test test/design/design_shots_test.dart`
renders 31 screens in light and dark with the real fonts to `build/design_shots/` — no
simulator needed. Text that shows as boxes there is text that does not inherit the theme
font (use `Text.rich`, not `RichText`).

## 11. Known gaps on web

- `components/ui` primitives still carry shadcn's `shadow-xs` on inputs, outline buttons
  and switches and `shadow-sm` on `Card` and the active tab. They are barely visible on
  the warm page, but they contradict principle 3. Remove them the next time the
  primitives are regenerated.
- `--color-pon-blue` / `--color-pon-green` are leftovers used by 6 call sites (call
  controls). Fold them into the semantic success colour.

## 12. Changing the system

1. Change the token on web first (`globals.css`), then mirror it in
   `apps/client/lib/core/theme/app_theme.dart` in the same PR (`.claude/rules/sync.md`).
2. Update this file in that PR.
3. Before merging, grep both apps for raw hex / `Colors.*` in the files you touched.
