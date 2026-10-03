# UI Redesign — History (Warm Grey & Burgundy)

> **This file is history.** The live specification — tokens, type, components, and what
> Flutter still has to change — is [`docs/design-system.md`](../design-system.md). Read
> that to build UI. Read this only to understand why the direction is what it is, or
> before running another repo-wide visual sweep.

## Why this direction

PON's first brand was a neon gradient (`ponCyan / ponPeach / ponPink`). It was replaced
on 2026-07-30 because it read as a generic consumer chat app and undercut the product's
B2B positioning (RBAC, SSO, audit log, admin console). Directions considered and rejected
before the current one was locked:

| Proposed | Rejected because |
|---|---|
| Neon, refined | Still looked cheap ("app Android dõm") |
| Dark indigo "AI SaaS" | The template every AI startup uses (Vercel / Linear / v0 look-alike) |
| Warm cream + terracotta | Too close to Anthropic / Claude's own brand |
| Stone & Petrol, Sage & Charcoal | Owner preferred the third recolour |
| **Warm Grey & Burgundy** | **Chosen and locked** |

The decision is closed: do not propose alternative colour directions.

## How it was rolled out

Executed 2026-07-30 → 07-31 in layers so one session never had to read all ~76 screens:
design tokens (L1) → shared components (L2) → a cross-cutting chrome sweep that removed
every elevation shadow, blur and candy radius (L3-pre) → eight per-area batches (auth,
chat, settings/profile, AI, admin, remainder, hairline regression, media corners + icon
family). The per-step records are the `plans/2026-07-30-ui-redesign-*.md` files; they are
kept as an archive and are not instructions.

## Lessons for the next sweep

These cost real rework during the rollout. Apply them whenever colours or shapes are
swept across the repo again.

1. **A "done" batch only certifies the files that existed that day.** Features added
   later (Integrations, Skills) reintroduced dark-only borders. Re-run the token greps
   whenever a new feature area lands.
2. **Renaming symbols does not catch local literals.** Old neon hexes survived three
   layers because they were inline `Color(0x…)` / `rgba()` values, not named tokens. Grep
   raw hex and rgba, not just symbol names.
3. **Grep the whole Material palette**, not only `Colors.white|black`:
   `Colors\.(grey|red|redAccent|blue|pink|purple|teal|cyan|indigo|green|amber|orange|yellow|lime|brown)`.
4. **Not every `Colors.white` is a bug.** White is correct on the accent (send button,
   unread badge, own bubble) and on media scrims; it is wrong on `surface` and
   `scaffoldBackground`. Alpha variants (`white70`, `withValues(alpha:)`) are never "on
   accent" and can be mapped wholesale.
5. **Mapping by alpha confuses fills with borders.** `white @ 5–25%` → hairline is right
   for a border and wrong for a background.
6. **Black on burgundy is ~2:1.** Grep `foregroundColor: Colors.black` and
   `onPrimary: Colors.black` on anything accent-filled.
7. **A per-item colour prop is the real violation.** `SettingsCard(glowColor:)`,
   `AiHubTile.accent`, `iconBg` invited a second accent. Replace the prop with a semantic
   flag (`destructive`) instead of fixing callers one by one.
8. **Flutter has no theme default unless you set one.** Missing `bottomSheetTheme` /
   `dialogTheme` is why ~25 call sites hardcoded a dark sheet that then rendered dark in
   light mode.
9. **A container's `borderRadius` does not clip its child.** A single image in a bubble
   had square corners until it got its own `ClipRRect`.
10. **Canvas does not resolve CSS variables.** `ctx.fillStyle = 'var(--primary)'` paints
    black; read the computed value first.
11. **An icon-family sweep flattens state pairs.** `isPinned ? push_pin : push_pin_outlined`
    became the same glyph twice with `flutter analyze` still green. Diff for two variants
    of one icon base in the same file.
12. **`flutter analyze`, tests and contrast maths do not catch "looks wrong".** Auth, chat
    and settings need a human look on a real screen in both themes after any sweep.
