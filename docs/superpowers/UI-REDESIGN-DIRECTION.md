# UI Redesign — Direction & Handoff (Warm Grey & Burgundy)

> **Purpose of this file:** orient a fresh session (Cowork or Claude Code) so it can continue this
> redesign program without re-litigating the visual direction. Read this top-to-bottom, then open
> the current plan file it points to.
>
> **Last updated:** 2026-07-30 — direction locked; **Layer 1 executed** (commit `86ca2212`),
> **Layer 2 executed** (commit `a26f492c`), and the **L3-pre cross-cutting chrome sweep executed**
> (commit `11d641aa`), **Layer 3 batches 1 (Auth), 2a+2b (Chat core) and 3 (Settings/Profile)**
> executed. All elevation shadows, glass blur and candy radii are gone. Next: batches 4–6 (AI /
> admin / remainder) — none written yet.
>
> **Do not assume the old brand is fully dead.** Each batch so far has found another old-brand or
> off-palette literal that earlier layers missed, because L1/L2 only renamed *symbols* while these
> were *local literals*: batch 2b found neon cyan `#4FE3FF`, batch 3 found neon cyan `#00E5FF` plus
> the rejected dark-indigo `#1A1A2E` and a violet `rgba(180,127,255,…)` on web. Grep every new batch
> for raw hex/rgba before declaring it clean.
>
> **None of this has been visually confirmed on a real screen yet** — auth, chat and settings are the
> three flows most worth eyeballing before continuing.
>
> **Lesson from batch 1: do not trust a previous layer's "done" claim without grepping.** Layer 2
> reported every aura orb and brand gradient removed, but all 6 Flutter auth screens still had both,
> plus a second accent and hardcoded `Colors.white` that made them illegible in light mode. Verify
> per-batch with a grep, don't assume.

---

## TL;DR

PON's UI (web + Flutter) is being redesigned end-to-end. The owner rejected two earlier directions
in review: (1) the original "Neon" brand (`ponCyan/ponPeach/ponPink` gradient) — looks like a
cheap/generic chat app, undercuts the product's actual B2B-enterprise positioning (RBAC, SSO, audit
log, admin console); (2) a dark indigo "AI SaaS" direction — rejected as the generic template every
AI wrapper startup uses right now (Vercel/Linear/v0 look-alike). A warm cream + terracotta direction
was also rejected as too close to Anthropic/Claude's own brand.

**Locked direction: "Warm Grey & Burgundy"** — warm neutral grey surfaces, ink-black text carrying
most of the hierarchy (weight over color), one deep wine/burgundy accent used sparingly for primary
actions only. No gradients, no neon, no glassmorphism. Sharp-ish corners (10–12px, not the old
16–20px "candy" radius). Full palette in §2.

---

## 1. Why this direction (decision log)

- **2026-07-30** — 3 initial directions proposed (A "Neon Refined", B "Enterprise Minimal" light,
  C "Aurora Glass"). Owner asked to drop neon entirely and go "chuyên nghiệp, không giống app
  Android dõm" (professional, not cheap-looking).
- **2026-07-30** — Proposed a dark indigo SaaS direction. Owner correctly called it out as the
  generic AI-startup template (same look as v0/Vercel/Linear dark mode) — rejected for being
  unoriginal, not for being unprofessional.
- **2026-07-30** — Proposed 3 alternatives (D "Warm Editorial", E "Nordic Data-grade", F "Corporate
  Navy"). Owner picked D's structure (warm, weight-led hierarchy, editorial) but D's original
  cream + terracotta palette read as a copy of Claude's own brand — rejected on that basis alone,
  structure kept.
- **2026-07-30** — Recolored D three ways (D1 Stone & Petrol, D2 Sage & Charcoal, D3 Warm Grey &
  Burgundy). **Owner picked D3.** Locked.
- **2026-07-30** — Working agreement confirmed: Cowork is planner only (research, propose, write
  `.md` plans here). Claude Code is the executor — reads a plan, implements, runs build/test,
  reports back. Cowork never edits app code directly for this program.

---

## 2. Locked palette — "Warm Grey & Burgundy"

One accent (burgundy/wine), warm-neutral (not blue-tinted) greys, text hierarchy driven by weight
+ shade more than by color. Exact CSS/Dart token values are specced in
`plans/2026-07-30-ui-redesign-p1-design-tokens.md` (P1) — this table is the source-of-truth
palette; P1 maps it onto both platforms' existing token systems.

| Role | Light mode | Dark mode | Notes |
|---|---|---|---|
| Page background | `#F5F2ED` | `#1A1614` | warm, not pure white/black |
| Card / surface | `#FFFFFF` | `#221D1A` | |
| Primary text | `#241F1D` | `#F3EEE8` | warm ink, not `#000`/`#FFF` |
| Secondary text | `#6B6259` | `#B0A79C` | |
| Border (hairline) | `#DDD8D0` | `#332B27` | 1px, no shadows for elevation |
| Accent / primary action | `#7A2E3A` | `#A8475A` | burgundy — buttons, links, focus ring, active states ONLY |
| Accent tint (subtle bg) | `#F1E4E6` | `#3A2A2C` | selected row, badge bg, hover |
| Destructive | `#B3261E` | `#E5484D` | keep semantically red, not burgundy (don't overload the accent hue) |
| Success | keep existing green (`onlineGreen`/`--chart-2` family) | — | out of scope for this redesign, presence dots etc. unchanged |

**Design rules for every screen touched in this program:**
1. One accent color per view. Burgundy = the only color allowed to mean "this is the primary
   action" — never decorate with it (no burgundy icons/borders on neutral content).
2. No gradients anywhere except where one already exists for a *documented brand mark* (the PON
   logo mark) — decorative gradients on cards/buttons/avatars are removed.
3. No drop shadows for elevation — use 1px borders + background-shade steps instead (`background`
   → `card` → `accent-tint`).
4. Radius: 8–10px for controls (buttons/inputs), 12px for cards, 16–20px only for full-screen
   sheets/modals/phone-frame-level containers. Never 20px+ on a button or a chat bubble.
5. Chat bubbles: asymmetric radius (one corner flattened toward the sender, e.g.
   `border-radius: 14px 14px 14px 4px` for incoming), not uniform pill shape.
6. Hierarchy comes from font-weight (400/500/600) and text-shade (`primary`/`secondary`/`muted`)
   first; color second. Don't reach for a new color to show "this is more important."

---

## 3. Rollout layers (how the whole program is sequenced)

Reason for layering: reading the entire ~76-screen codebase in one session is what caused the
original attempt (via a different tool) to run out of context before finishing. Each layer/plan
below is scoped so a single Claude Code session only needs to read a handful of files.

### Layer 1 — Design tokens (foundation, do first) ✅ done, commit `86ca2212`
Plan: `plans/2026-07-30-ui-redesign-p1-design-tokens.md` — **done, commit `86ca2212`.**
Touches only: `apps/web/app/globals.css`, `apps/client/lib/core/theme/app_theme.dart`. Everything
downstream inherits automatically because shadcn (`components/ui/*`) reads CSS variables and
Flutter's `ColorScheme`/`ThemeData` propagate through Material widgets.

### Layer 2 — Shared component visual language ✅ done, commit `a26f492c`
Plan (written during execution, as the decision record):
`plans/2026-07-30-ui-redesign-p2-component-language.md`. Delivered:
- Symbols renamed for real — web `pon-cyan/peach/pink` → the theme-aware `primary` token (the 3
  `--color-pon-*` tokens deleted); Flutter `ponCyan/ponPeach/ponPink` → one `ponAccent`,
  `ponGradient` deleted. L1's `TODO(ui-redesign-L2)` markers are all paid off.
- Degenerate brand gradients collapsed to flat fills; decorative aura orbs and every coloured
  glow shadow removed; the AI-purple second accent folded into the one accent.
- `pon_widgets.dart` rewritten: `PonCard` = opaque surface + 1px hairline (no glass/glow),
  `PonButton` = flat accent + 10px radius, `PonTextField` focus = theme border, `PonLogo` flat.
- Both logo marks now flat `currentColor`; `app/icon.svg` keeps a literal hex (CSS vars don't
  resolve in a standalone favicon).
- `AuthShowcasePanel` rewritten to dark-scoped tokens instead of a hardcoded indigo gradient.
- Chat bubbles asymmetric 14/4 on both platforms.
- `components/ui/` untouched (verified: no shadcn file references a brand token).
- Deliberately kept: motion tokens, success green, connector brand colours, chat wallpaper
  presets (user-selectable content, not chrome).

### L3-pre — Cross-cutting chrome sweep ✅ done, commit `11d641aa`
Plan (written during execution, as the decision record):
`plans/2026-07-30-ui-redesign-l3-pre-chrome-sweep.md`. 57 files. Sits between Layer 2 and Layer 3
because §2 rules 2–5 are mechanical and identical on every screen — doing them once is cheaper and
more consistent than spreading them over 6 per-screen batches. Delivered:
- Every elevation shadow gone on both platforms (web `shadow-*`, Flutter `boxShadow`); each floating
  surface was checked to already carry a 1px border before its shadow was removed.
- All glassmorphism gone (`backdrop-blur` 28 → 0, `BackdropFilter` 1 → 0). Surfaces that existed
  only to be blurred are now **genuinely opaque** — keeping the alpha after removing the blur let
  scrolled content bleed through sticky headers, tab bars and composer chrome.
- Candy radii normalised; chat bubbles asymmetric 14/4; OTP box unified to 10px on both platforms
  (was 6px web / 12px Flutter — also a `sync.md` parity fix).
- Recovered an interrupted session and fixed two bugs it left behind: the mangled Tailwind class
  `md:-none` (from cutting `md:backdrop-blur-none`) and a failing `flutter analyze`.

### Layer 3 — Per-screen rollout batches (do after L3-pre, one plan per batch)
Not yet written. Chrome (shadow/glass/radius) is already handled by L3-pre — each batch now only
owns its screen's spacing, typography, layout, the remaining oversized Flutter radii inside
per-screen widgets (37 sites), and the ad-hoc text-alpha → token audit. Proposed batches (each =
one Claude Code session, one plan.md):
1. ~~Auth~~ ✅ **done** — `plans/2026-07-30-ui-redesign-l3-batch1-auth.md`. Key finding: the two
   platforms had drifted badly — web auth was already clean from Layer 2, while **all 6 Flutter auth
   screens still had the neon legacy and were illegible in light mode** (hardcoded `Colors.white` on
   the `#F5F2ED` page). Also removed a second accent (amber), the accent aura orbs Layer 2 missed,
   and the no-op compat params at every auth call site. Added `AppTheme.mutedText(context)` /
   `AppTheme.hairline(context)` resolvers so screens never hardcode white/black again — **use these
   in the remaining batches.**
2. Chat core — **split into 2a/2b**, because this batch is *not* 13 screens: `features/chat` has
   **79 UI files** and ~390 hardcoded colour literals.
   - **2a ✅ done** — `plans/2026-07-30-ui-redesign-l3-batch2a-chat-structural.md`. Root causes +
     high-traffic surfaces. Biggest find: the theme had **no `bottomSheetTheme`/`dialogTheme`**,
     which is *why* ~25 call sites hardcoded a dark sheet (so sheets/dialogs rendered dark in light
     mode). Also: the accent hex was hand-copied in **31** places instead of using `ponAccent`, and
     a **teal `#14B8A6` second accent** lived in the external-bot avatar on both platforms.
   - **2b ✅ done** — `plans/2026-07-30-ui-redesign-l3-batch2b-chat-longtail.md`. The long tail:
     ~270 colour literals → tokens across 53 chrome widgets, 26 radii normalised. Found the old
     **neon cyan `#4FE3FF` still alive** in an AI source chip (L1/L2 both missed it because it was a
     local literal, not a symbol), plus purple/teal leftovers and two black-on-burgundy contrast
     bugs. Also fixed a light-mode regression 2a itself introduced (dialogs lost their dark
     background override while keeping white text).
     ⚠️ `lib/features/chat` is **not** `dart format`-clean; do semantic edits only or the diff
     drowns in formatting noise.

**Two rules the remaining batches must inherit from 2b:**
1. **Not every `Colors.white` is a bug.** White is *correct* on the burgundy accent (send button,
   unread badge, bot avatar, own bubble) and on media/black scrims (viewer, call). It is *wrong* on
   `surface`/`scaffoldBackground`. Safe split: the shade/alpha variants (`white70`, `white24`,
   `withValues(alpha:…)`, `black87`…) are never "on accent", so they can be mapped wholesale; plain
   `Colors.white` must be checked per site.
2. **Mapping by alpha confuses fills with borders.** `white@5–25%` → `hairline` is right for a
   border and wrong for a background; 2b had to walk back 4 such sites. Check each one's role.
3. **Grep these two patterns first — they are recurring bugs, not style nits** (2b found 2, batch 3
   found 5): `foregroundColor: Colors.black` and `onPrimary: Colors.black` on anything filled with
   the accent. Black on burgundy is ~2:1.
4. **A per-item colour *prop* is the real violation, not the call site.** Batch 3 found
   `SettingsCard(glowColor:)` on Flutter and `iconBg`/`glowColor` on web — APIs that invite a second
   accent. Replace the prop with a semantic flag (`destructive`) instead of fixing callers one by one.
5. **Before regex-deleting a param by name, check for `required this.<name>`** — batch 3's sweep for
   Layer 2's no-op `glowColor` also hit a local widget's genuinely-required param of the same name.
3. ~~Settings/Profile~~ ✅ **done** — `plans/2026-07-30-ui-redesign-l3-batch3-settings-profile.md`.
   Also swept `token-usage` (its Flutter mirror lives under `settings/`). Biggest find: the
   *per-card colour API itself* — Flutter `SettingsCard` took a `required Color glowColor` and web
   took `iconBg: string`, so every card could pick its own hue, and four web cards were passing a
   violet second accent. Both now derive the tint from a `destructive` flag, giving the two
   platforms the same API. Also: leftover **neon cyan** in the usage chart, the rejected
   **dark-indigo `#1A1A2E`**, 4 more aura orbs, and 5 black-on-burgundy contrast bugs.
4. AI features — `ai_context/`, `ai_hub/`, `assistant/` (5 Flutter) + `ai-context/`, `ai-hub/`,
   `assistant/*`, `ai-persona/`, `ai-memory/` (8 web pages)
5. Admin console — `apps/client/lib/features/admin/` (1 shell, many tabs) + `apps/web/app/(main)/admin/*` (9 pages)
6. Remainder — friends, reminders, help, integrations, skills, legal, explore, shared-media,
   token-usage, blocked, archived

Each batch plan must, per `.claude/rules/sync.md`, cover its web AND Flutter mirror together (not
split across two sessions) so the two platforms never drift.

---

## 4. How to resume

- If you're Cowork and asked to continue this program: read this file, check which plan in §3 is
  next un-written, write it following the format of `plans/2026-07-30-ui-redesign-p1-design-tokens.md`,
  do not touch app code yourself.
- If you're Claude Code and handed a plan from this program: execute it, run the verification
  commands in the plan, report back — do not invent new colors or deviate from §2.
- Do not re-propose alternative color directions — that decision is closed (§1).
