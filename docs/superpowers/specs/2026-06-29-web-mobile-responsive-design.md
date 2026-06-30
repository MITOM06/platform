# Web Mobile Responsive Overhaul — Design Spec

**Date:** 2026-06-29
**Owner:** Tran Phuc Khang
**Scope:** `apps/web` (Next.js web client) only — make the web app fully usable on real mobile devices.
**Approach:** Hướng A — build shared responsive primitives first, then apply them across all surfaces.

---

## 1. Problem

Users report that "many features are unusable on web mobile" when accessed from a **real phone browser**.
A static survey found the chat core is largely responsive, but several surfaces break or degrade badly
on narrow viewports, and real-device-only issues (safe-area, on-screen keyboard, `100vh` overshoot,
sub-44px touch targets) are not handled at all.

Confirmed pain areas (all selected by owner): **Admin/Workspace, Usage/Token/Dashboard, Chat, Modal/Drawer/Settings.**

### Concrete defects found (with file paths)

- 🔴 **Admin Roles/Permissions matrix** — `components/admin/RolesPanel.tsx`: capability column `min-w-44`
  + N role columns `min-w-32` each → overflows 375px even with one role; checkboxes are sub-44px.
- 🔴 **Usage Dashboard** — `components/admin/usage-dashboard-parts.tsx`: `PerModelCostTable`, `TopUsersTable`
  are raw `<table>` with small text; `DailyBarChart` canvas (`w-full h-40`) gets crowded/illegible at 375px
  with ~30 days of data.
- 🔴 **Admin Members** — `components/admin/MembersPanel.tsx`: table layout + edit dialog, same overflow class.
- 🟡 **Modals/Dialogs** — `components/ui/dialog.tsx`: `max-w-[calc(100%-2rem)]` → ~343px usable on a 375px
  phone; multi-field forms scroll awkwardly and don't use available height.
- 🟡 **Chat real-device** — chat screen relies on `vh`/`h-screen`-style sizing; on real phones the browser
  chrome and on-screen keyboard cover the input bar; header action buttons are cramped on narrow widths.
- 🟡 **Bottom padding hacks** — Friends/Explore/Integrations/AI-Hub/Settings use ad-hoc `pb-20 md:pb-4`
  (etc.) for the floating tab bar → inconsistent dead space above the tab bar.
- ⚪ **Viewport meta / safe-area** — no `viewport-fit=cover`; safe-area is inlined only in
  `components/layout/MobileTabBar.tsx`; no shared safe-area utilities.

### Out of scope

- Flutter client (`apps/client`) — it is native mobile and already mobile-shaped. This is a responsive-**web**
  effort, so the cross-platform `sync.md` rule does **not** apply here (no mobile mirror change is implied by
  these web-only layout fixes).
- No backend/API changes. No new features — layout/responsiveness only.
- No visual redesign of the desktop layout beyond what's needed to add a mobile breakpoint path.

---

## 2. Technical context (verified)

- **Tailwind v4** (CSS-first config in `app/globals.css` via `@import "tailwindcss"` + `@theme`). No
  `tailwind.config.js`. `h-dvh` / `min-h-dvh` utilities exist natively in v4.
- **Next.js 16** App Router. Root layout: `app/layout.tsx`. Authenticated shell: `app/(main)/layout.tsx`
  (sidebar + main, already single-pane on mobile via `hidden md:flex` toggling on `isConversationOpen`).
- Breakpoint contract: `md` = 768px is the desktop/mobile divider already used by the shell. Keep it.
- shadcn/ui primitives in `components/ui/` (`dialog.tsx`, `sheet.tsx`). Per project rule these are not
  hand-edited as generated components — new responsive wrappers are **new** files that compose them.
- File length limit: **≤400 lines/file** (clean-code rule). Splitting into primitives is partly to honor this.

---

## 3. Design

### 3.1 Foundation — responsive primitives (built first)

All in `app/globals.css` unless noted.

1. **App viewport height.** Add a `.h-app` utility = `100dvh` (with `100vh` fallback for old browsers), used by
   the app shell and the chat screen so mobile browser chrome / keyboard no longer hides content. Tailwind v4
   `@utility` or a plain CSS class.
2. **Safe-area utilities.** Add `.pt-safe / .pb-safe / .pl-safe / .pr-safe` (and combined `.p-safe`) wrapping
   `env(safe-area-inset-*)`, additive with existing padding where needed. Replace the inline `env()` in
   `MobileTabBar.tsx` with `.pb-safe`. Apply to chat header, chat input bar, and bottom sheets.
3. **Touch target.** Add `.tap` = `min-height:44px; min-width:44px;` (with centering) for icon buttons in the
   chat header, message input, and table actions.
4. **Viewport meta.** In `app/layout.tsx`, set the Next `viewport` export to include
   `viewportFit: 'cover'` (enables safe-area) and `width: 'device-width', initialScale: 1`. Confirm no
   `maximum-scale`/`user-scalable=no` (accessibility — must allow zoom).

### 3.2 `ResponsiveTable` — `components/ui/responsive-table.tsx` (new)

Generic list-table component.

- **API:** `columns: { key, header, render?, className?, hideOnMobile?, primary?, priority? }[]`,
  `rows: T[]`, `getRowKey: (row) => string`, optional `onRowClick`.
- **md+:** renders a real `<table>` (current desktop look preserved).
- **mobile (<md):** renders a stacked **card list** — one card per row; each visible column becomes a
  `label : value` line; `primary` column is the card title. `hideOnMobile` columns drop on mobile.
- **Consumers:** Admin Members (`MembersPanel.tsx`), Usage `PerModelCostTable` + `TopUsersTable`
  (`usage-dashboard-parts.tsx`).
- Kept under 400 lines; if it grows, split the mobile-card renderer into a sibling file.

### 3.3 Admin Roles/Permissions — bespoke mobile view

The capability×role matrix cannot fit a narrow screen, so `ResponsiveTable` does not apply.

- **Desktop (md+):** keep the existing matrix table in `RolesPanel.tsx`.
- **Mobile (<md):** a **role selector** (dropdown/segmented) → a vertical list of capabilities, each with a
  toggle bound to the selected role. Same mutation handlers as desktop; only the layout differs.
- Extract the mobile view into a sibling component (`RolesPanelMobile.tsx` or a private sub-component) to keep
  `RolesPanel.tsx` ≤400 lines.

### 3.4 `ChartCard` + responsive canvas — `components/admin/` 

- Wrapper that owns a `ResizeObserver` + `devicePixelRatio` scaling so the canvas is crisp and sized to its
  container on any width.
- **Mobile density:** reduce x-axis label density (e.g. show every Nth day) or allow horizontal scroll of the
  plot inside a fixed-height frame; never silently clip data.
- Always render a **summary line** (totals / peak) above the chart so the numbers are legible even when the
  plot is dense.
- Refactor `DailyBarChart` in `usage-dashboard-parts.tsx` to draw through this wrapper.

### 3.5 `ResponsiveModal` — `components/ui/responsive-modal.tsx` (new)

- Composes shadcn `Sheet` and `Dialog`.
- **mobile (<md):** bottom **Sheet**, full-width, `max-h-[90dvh]`, internal scroll, `.pb-safe`.
- **md+:** `Dialog` (existing behavior).
- Single API (`open`, `onOpenChange`, `title`, `description`, `children`, `footer`) so callers don't branch.
- **Consumers:** `NewConversationModal`, `WallpaperPickerModal`, the settings drawers
  (Group / Conversation / UserProfile), Admin member-edit dialog, and the Emoji/Sticker picker
  (`EmojiStickerPicker.tsx`) → bottom sheet on mobile.

### 3.6 Chat real-device fixes

- Chat screen container uses `.h-app` (dvh) instead of viewport-relative full-height that overshoots.
- **Keyboard:** input bar is bottom-anchored; rely on `dvh` + (where needed) a small `visualViewport`
  listener so the composer stays visible above the on-screen keyboard rather than being covered/pushed.
- **Header overflow:** on mobile, collapse secondary header actions (call/video/search/etc.) into a single
  overflow (`…`) menu so the title/avatar aren't crushed; keep them inline on md+.
- Apply `.tap` to header and input icon buttons.
- Files: `components/chat/ConversationHeader.tsx`, `components/chat/MessageInput.tsx`,
  `app/(main)/conversations/[id]/page.tsx`, `app/(main)/layout.tsx` (shell height).

### 3.7 Padding cleanup

Replace ad-hoc `pb-20 md:pb-4`-style hacks in Friends/Explore/Integrations/AI-Hub/Settings with a single
consistent rule: content scroll containers get bottom space equal to the mobile tab-bar height + safe area
(e.g. a shared `.pb-tabbar` utility = tab-bar height + `env(safe-area-inset-bottom)`), and `md:` resets it.

---

## 4. Rollout order

1. **Foundation** (§3.1) — utilities + viewport meta. Nothing else can be applied cleanly without these.
2. **Chat** (§3.6) — highest-traffic surface; validates `.h-app` / safe-area / `.tap` on a real device early.
3. **Admin Roles + Members** (§3.2, §3.3) — the worst 🔴 offenders.
4. **Usage/Token tables + charts** (§3.2, §3.4).
5. **Modal/Drawer/Settings** (§3.5).
6. **Padding cleanup** (§3.7) across the remaining list pages.

Each step ends with `pnpm build` green and a DevTools check at 375 / 390 / 430px.

---

## 5. Testing & verification

- **Build:** `pnpm build` (TypeScript strict, must pass) after each rollout step and at the end.
- **DevTools responsive:** verify each surface at 375 / 390 / 430px — no horizontal page scroll, no clipped
  controls, tables become cards, modals become sheets, charts legible.
- **Real-device checklist (owner confirms on phone):** safe-area insets (notch / home indicator) respected;
  chat input stays visible when keyboard opens; tab bar not overlapped by gesture bar; no `100vh` overshoot
  hiding the composer. These cannot be fully verified in DevTools.

## 6. Risks / notes

- shadcn `dialog.tsx` / `sheet.tsx` are generated — compose them in new wrappers, do not hand-edit the
  generated files.
- Keep every touched/added file ≤400 lines; split when needed (noted per component above).
- `visualViewport` keyboard handling must be feature-detected and a no-op on desktop.
- Allow user zoom (no `user-scalable=no`) for accessibility.
