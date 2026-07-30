# UI Redesign — Direction & Handoff (Warm Grey & Burgundy)

> **Purpose of this file:** orient a fresh session (Cowork or Claude Code) so it can continue this
> redesign program without re-litigating the visual direction. Read this top-to-bottom, then open
> the current plan file it points to.
>
> **Last updated:** 2026-07-30 — direction locked; **Layer 1 executed** (commit `86ca2212`),
> **Layer 2 executed** (commit `a26f492c`), and the **L3-pre cross-cutting chrome sweep executed**
> (commit `11d641aa`). The old neon brand is fully gone from both apps, and so are all elevation
> shadows, glass blur, and candy radii. Next un-written plans: Layer 3 per-screen batches. **None of
> this has been visually confirmed on a real screen yet — do that before starting Layer 3.**

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
1. Auth — `apps/client/lib/features/auth/` (6 screens) + `apps/web/app/(auth)/*` (5 pages)
2. Chat core — `apps/client/lib/features/chat/` (13 screens) + `apps/web/app/(main)/conversations/*`
3. Settings/Profile — `apps/client/lib/features/settings/`, `profile/` (6) + web equivalents (~6)
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
