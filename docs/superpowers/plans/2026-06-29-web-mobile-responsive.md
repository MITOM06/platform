# Web Mobile Responsive Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Next.js web app (`apps/web`) fully usable on real mobile phone browsers by building shared responsive primitives and applying them to every broken surface.

**Architecture:** Hướng A — first add foundation utilities (safe-area, touch-target, tab-bar reserve, viewport-fit), then build three reusable primitives (`ResponsiveTable`, `ResponsiveModal`, responsive `ChartCard`), then apply them across Chat, Admin, Usage, Modals/Settings, and clean up ad-hoc bottom-padding hacks.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript strict, Tailwind CSS v4 (CSS-first config in `app/globals.css`, native `h-dvh`/`@utility`), shadcn/ui (`components/ui/dialog.tsx`, `sheet.tsx`).

## Global Constraints

- Scope is **`apps/web` only**. No backend/API changes. No new product features — layout/responsiveness only.
- Cross-platform `sync.md` rule does **not** apply (Flutter is native mobile; these are web-only layout fixes).
- **≤400 lines per file** (clean-code rule). Split when a file would exceed it.
- shadcn generated files (`components/ui/dialog.tsx`, `components/ui/sheet.tsx`) are **not hand-edited** — compose them in new wrapper files.
- TypeScript `strict: true`, **no `any`** (use `unknown` + guard, or generics).
- Tailwind v4: no `tailwind.config.js`; add custom utilities via `@utility` in `app/globals.css`.
- Desktop/mobile divider breakpoint is **`md` = 768px** (already used by the shell). Keep it.
- Allow user zoom — never emit `user-scalable=no` / `maximum-scale`.
- **No web test runner is configured.** Per-task verification = `pnpm build` (Next type-check + lint must pass) + manual DevTools responsive check at **375 / 390 / 430px**. Real-device-only behaviors (safe-area, keyboard) go on the owner checklist in Task 11.
- Run all commands from `apps/web/`: `cd apps/web && pnpm build`.
- Commit after each task. End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

**New files:**
- `apps/web/lib/hooks/use-is-mobile.ts` — SSR-safe `md` breakpoint hook (JS) for components that must pick a layout at render time.
- `apps/web/components/ui/responsive-table.tsx` — table on `md+`, stacked cards on mobile.
- `apps/web/components/ui/responsive-modal.tsx` — Dialog on `md+`, bottom Sheet on mobile.
- `apps/web/components/admin/RolesPanelMobile.tsx` — mobile role-selector + capability toggle list.

**Modified files:**
- `apps/web/app/globals.css` — add `@utility` blocks: `pb-safe`, `pt-safe`, `pl-safe`, `pr-safe`, `tap`, `pb-tabbar`.
- `apps/web/app/layout.tsx` — add `viewport` export with `viewportFit: 'cover'`.
- `apps/web/components/layout/MobileTabBar.tsx` — inline `env()` → `.pb-safe`.
- `apps/web/components/chat/MessageInput.tsx` — inline `env()` → `.pb-safe`; `.tap` on icon buttons.
- `apps/web/components/chat/ConversationHeader.tsx` — collapse secondary actions into overflow menu on mobile; `.tap`.
- `apps/web/components/admin/RolesPanel.tsx` — render mobile view (<md) / table (md+).
- `apps/web/components/admin/usage-dashboard-parts.tsx` — `PerModelCostTable`/`TopUsersTable` → `ResponsiveTable`; `DailyBarChart` responsive + summary line.
- `apps/web/components/chat/NewConversationModal.tsx`, `WallpaperPickerModal.tsx`, `UserProfileDrawer.tsx` — use `ResponsiveModal`.
- Bottom-padding cleanup: `app/(main)/friends/page.tsx`, `explore/page.tsx`, `settings/page.tsx`, `integrations/page.tsx`, `ai-hub/page.tsx`, `skills/page.tsx`, `help/page.tsx`, `components/admin/AdminShell.tsx`, `components/profile/ProfileForm.tsx`, and `app/(main)/layout.tsx:390` (sidebar `pb-16`).

---

## Task 1: Foundation — responsive utilities + viewport meta

**Files:**
- Modify: `apps/web/app/globals.css` (after line 2, near top-level utilities)
- Modify: `apps/web/app/layout.tsx:18-27` (add `viewport` export)
- Modify: `apps/web/components/layout/MobileTabBar.tsx:26-28`

**Interfaces:**
- Produces: CSS utility classes `.pb-safe .pt-safe .pl-safe .pr-safe`, `.tap`, `.pb-tabbar` (used by all later tasks).

- [ ] **Step 1: Add utilities to `app/globals.css`**

Insert after line 2 (`@import "tw-animate-css";`):

```css

/* ── Responsive / mobile primitives ─────────────────────────────────────── */
/* Safe-area insets (notch / home indicator). Additive padding on the named side. */
@utility pb-safe { padding-bottom: env(safe-area-inset-bottom); }
@utility pt-safe { padding-top: env(safe-area-inset-top); }
@utility pl-safe { padding-left: env(safe-area-inset-left); }
@utility pr-safe { padding-right: env(safe-area-inset-right); }

/* Minimum 44×44 touch target for icon buttons on mobile. */
@utility tap { min-width: 44px; min-height: 44px; }

/* Bottom space that clears the fixed mobile tab bar (h-16 = 4rem) + safe area. */
@utility pb-tabbar { padding-bottom: calc(4rem + env(safe-area-inset-bottom)); }
```

- [ ] **Step 2: Add `viewport` export in `app/layout.tsx`**

After the `metadata` export (ends line 27), add:

```tsx
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
```

(If `import type { Metadata } from 'next'` already exists, add `Viewport` to that same import instead of a second line.)

- [ ] **Step 3: Replace inline safe-area in `MobileTabBar.tsx`**

Change line 26-28 — remove the `style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}` and append `pb-safe` to the className:

```tsx
<nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur-md flex items-stretch pb-safe">
```

- [ ] **Step 4: Build**

Run: `cd apps/web && pnpm build`
Expected: PASS (no type/lint errors). The new `@utility` classes compile.

- [ ] **Step 5: Manual check**

DevTools at 375px: tab bar still pinned bottom, content not under the notch. No visual regression on desktop.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/layout.tsx apps/web/components/layout/MobileTabBar.tsx
git commit -m "feat(web): responsive foundation utilities + viewport-fit cover

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `useIsMobile` hook

**Files:**
- Create: `apps/web/lib/hooks/use-is-mobile.ts`

**Interfaces:**
- Produces: `useIsMobile(): boolean` — `true` when viewport `< 768px`. SSR-safe: returns `false` before mount, then tracks `matchMedia`.

> First check for an existing shadcn hook: `grep -ri "use-mobile\|useIsMobile" apps/web/components/ui apps/web/lib`. If one exists with the same 768px semantics, skip creation and import it in Task 6/9 instead.

- [ ] **Step 1: Create the hook**

```ts
'use client'

import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 767px)' // < md (768px)

/** True when the viewport is narrower than the `md` breakpoint. SSR-safe. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isMobile
}
```

- [ ] **Step 2: Build**

Run: `cd apps/web && pnpm build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/hooks/use-is-mobile.ts
git commit -m "feat(web): add SSR-safe useIsMobile hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `ResponsiveTable` primitive

**Files:**
- Create: `apps/web/components/ui/responsive-table.tsx`

**Interfaces:**
- Consumes: nothing (pure component).
- Produces:
  ```ts
  interface ResponsiveColumn<T> {
    key: string
    header: React.ReactNode
    render?: (row: T) => React.ReactNode
    className?: string
    hideOnMobile?: boolean
    primary?: boolean
  }
  function ResponsiveTable<T>(props: {
    columns: ResponsiveColumn<T>[]
    rows: T[]
    getRowKey: (row: T) => string
    onRowClick?: (row: T) => void
    empty?: React.ReactNode
    className?: string
  }): JSX.Element
  ```
  Used by Task 9 (Usage tables).

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ResponsiveColumn<T> {
  key: string
  header: ReactNode
  /** Custom cell renderer. Falls back to `row[key]` if omitted. */
  render?: (row: T) => ReactNode
  className?: string
  /** Drop this column from the mobile card view. */
  hideOnMobile?: boolean
  /** Use as the card title on mobile (one column should set this). */
  primary?: boolean
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: ReactNode
  className?: string
}

function cellValue<T>(col: ResponsiveColumn<T>, row: T): ReactNode {
  if (col.render) return col.render(row)
  return (row as Record<string, ReactNode>)[col.key]
}

export function ResponsiveTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  empty,
  className,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        {empty ?? 'No data'}
      </div>
    )
  }

  const primary = columns.find((c) => c.primary)
  const mobileRest = columns.filter((c) => !c.primary && !c.hideOnMobile)

  return (
    <>
      {/* Desktop: real table */}
      <div className={cn('hidden md:block overflow-x-auto', className)}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {columns.map((c) => (
                <th key={c.key} className={cn('py-2 px-3 font-medium', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className={cn(
                  'border-b last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-muted/50',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('py-2 px-3', c.className)}>
                    {cellValue(c, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={getRowKey(row)}
            className={cn(
              'rounded-lg border bg-card p-3',
              onRowClick && 'cursor-pointer active:bg-muted/50',
            )}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {primary && (
              <div className="font-medium mb-2 break-words">{cellValue(primary, row)}</div>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {mobileRest.map((c) => (
                <Fragment key={c.key}>
                  <dt className="text-muted-foreground">{c.header}</dt>
                  <dd className="text-right tabular-nums">{cellValue(c, row)}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Build**

Run: `cd apps/web && pnpm build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/ui/responsive-table.tsx
git commit -m "feat(web): ResponsiveTable primitive (table desktop / cards mobile)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `ResponsiveModal` primitive

**Files:**
- Create: `apps/web/components/ui/responsive-modal.tsx`

**Interfaces:**
- Consumes: `useIsMobile` (Task 2); `Dialog*`/`Sheet*` from `components/ui`.
- Produces:
  ```ts
  function ResponsiveModal(props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title?: React.ReactNode
    description?: React.ReactNode
    children: React.ReactNode
    footer?: React.ReactNode
    className?: string
  }): JSX.Element
  ```
  Used by Task 10.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn('max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-safe', className)}
        >
          {(title || description) && (
            <SheetHeader>
              {title && <SheetTitle>{title}</SheetTitle>}
              {description && <SheetDescription>{description}</SheetDescription>}
            </SheetHeader>
          )}
          {children}
          {footer && <SheetFooter>{footer}</SheetFooter>}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[90dvh] overflow-y-auto', className)}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Build**

Run: `cd apps/web && pnpm build`
Expected: PASS.

- [ ] **Step 3: Manual check**

Mount it temporarily on any page (or via the consumers in Task 10): at 375px it slides up from the bottom and scrolls; at desktop it is a centered dialog. Remove any temporary mount before commit.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/responsive-modal.tsx
git commit -m "feat(web): ResponsiveModal (dialog desktop / bottom-sheet mobile)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Chat — message input touch targets + safe-area

**Files:**
- Modify: `apps/web/components/chat/MessageInput.tsx:241` (outer container) and the icon buttons in lines 301-401.

**Interfaces:**
- Consumes: `.pb-safe`, `.tap` (Task 1).

- [ ] **Step 1: Replace inline safe-area on the outer container**

Line 241 — remove `style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}` and add `pb-safe`:

```tsx
<div className="flex flex-col border-t bg-background pb-safe">
```

- [ ] **Step 2: Add `.tap` to the composer icon buttons**

In the non-recording row (lines 301-401), append `tap` to the className of each icon `<Button>` (attach, emoji trigger, send, mic, reaction) so they meet 44×44 on mobile. Example for the send button:

```tsx
<Button ... className={cn('...existing classes...', 'tap')}>
```

Apply the same `'tap'` addition to: the attach button, the emoji-picker trigger button, the mic/record button, and the reaction button. Do not change their existing sizing classes — `tap` only sets a minimum.

- [ ] **Step 3: Build**

Run: `cd apps/web && pnpm build`
Expected: PASS.

- [ ] **Step 4: Manual check**

DevTools at 375px: composer buttons are comfortably tappable; input row not clipped; bottom inset respected (visible in device frames with a home indicator).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/chat/MessageInput.tsx
git commit -m "feat(web): chat composer safe-area + 44px touch targets

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Chat — header overflow menu on mobile

**Files:**
- Modify: `apps/web/components/chat/ConversationHeader.tsx:158-197` (action buttons section)
- Verify a DropdownMenu primitive exists: `apps/web/components/ui/dropdown-menu.tsx` (shadcn). If absent: `cd apps/web && npx shadcn@latest add dropdown-menu`.

**Interfaces:**
- Consumes: `useIsMobile` (Task 2), `.tap` (Task 1), `DropdownMenu*` from `components/ui/dropdown-menu`.

- [ ] **Step 1: Confirm dropdown-menu primitive**

Run: `ls apps/web/components/ui/dropdown-menu.tsx`
If it does not exist, run: `cd apps/web && npx shadcn@latest add dropdown-menu` (commit it as part of this task).

- [ ] **Step 2: Keep the primary action inline, move the rest into a menu on mobile**

In the action section (currently `<div className="flex items-center gap-0.5 shrink-0">` at line 158), keep at most ONE primary action visible on mobile (the call button) and move the remaining actions (e.g. voice/video/settings) into an overflow `DropdownMenu` triggered by a `MoreVertical` icon button. On `md+`, render all actions inline as today.

Replace the action `<div>` body with:

```tsx
<div className="flex items-center gap-0.5 shrink-0">
  {/* Primary action: always visible */}
  {/* ...keep the existing primary call <Button> here, add `tap` to its className... */}

  {/* Desktop: remaining actions inline */}
  <div className="hidden md:flex items-center gap-0.5">
    {/* ...the existing secondary action <Button>s (voice/video/settings)... */}
  </div>

  {/* Mobile: overflow menu */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="md:hidden tap" aria-label="More">
        <MoreVertical className="size-5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {/* One DropdownMenuItem per secondary action, calling the SAME handler
          the inline button calls. Example: */}
      {/* <DropdownMenuItem onClick={onOpenSettings}>Settings</DropdownMenuItem> */}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

Add imports at the top of the file:

```tsx
import { MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
```

Map each existing secondary action button to a `DropdownMenuItem` with the same `onClick` handler and a text label (use the existing i18n string already used for that button's tooltip/aria-label).

- [ ] **Step 3: Build**

Run: `cd apps/web && pnpm build`
Expected: PASS.

- [ ] **Step 4: Manual check**

At 375px: header shows avatar + name + one primary action + a `⋮` menu; name no longer crushed. At ≥768px: all actions inline, no `⋮`. Every menu item triggers the same drawer/sheet it did before.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/chat/ConversationHeader.tsx apps/web/components/ui/dropdown-menu.tsx
git commit -m "feat(web): chat header overflow menu on mobile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Admin Roles — mobile view

**Files:**
- Create: `apps/web/components/admin/RolesPanelMobile.tsx`
- Modify: `apps/web/components/admin/RolesPanel.tsx:77-146` (wrap table for `md+`, render mobile view `<md`)

**Interfaces:**
- Consumes from `RolesPanel`: the role list (`Role[]` with `_id`, `name`, `permissions`), the capability list (the `cap` keys iterated in the table body), and the existing handlers `toggle(roleId, cap)`, `isDirty(role)`, `saveRole(role)`.
- Produces: `RolesPanelMobile` component.

> Read `RolesPanel.tsx` first to capture the exact `Role` type, the capability source (the array/object the table rows iterate over), and the precise signatures of `toggle`, `isDirty`, `saveRole`. Pass these in as props — do not duplicate the data fetching.

- [ ] **Step 1: Create `RolesPanelMobile.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Mirror the Role shape used in RolesPanel.tsx (id, name, permissions map).
interface RoleLike {
  _id: string
  name: string
  permissions: Record<string, boolean>
}

interface RolesPanelMobileProps<R extends RoleLike> {
  roles: R[]
  capabilities: string[]
  edited: Record<string, Record<string, boolean>>
  toggle: (roleId: string, cap: string) => void
  isDirty: (role: R) => boolean
  saveRole: (role: R) => void
  /** Optional humanizer for a capability key → label. */
  capLabel?: (cap: string) => string
}

export function RolesPanelMobile<R extends RoleLike>({
  roles,
  capabilities,
  edited,
  toggle,
  isDirty,
  saveRole,
  capLabel,
}: RolesPanelMobileProps<R>) {
  const [selectedId, setSelectedId] = useState(roles[0]?._id ?? '')
  const role = roles.find((r) => r._id === selectedId) ?? roles[0]
  if (!role) return null

  const valueFor = (cap: string) =>
    edited[role._id]?.[cap] ?? role.permissions[cap] ?? false

  return (
    <div className="md:hidden flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={role._id} onValueChange={setSelectedId}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r._id} value={r._id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!isDirty(role)}
          onClick={() => saveRole(role)}
        >
          Save
        </Button>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border">
        {capabilities.map((cap) => (
          <li key={cap} className="flex items-center justify-between gap-3 p-3">
            <span className="text-sm">{capLabel ? capLabel(cap) : cap}</span>
            <Switch
              checked={valueFor(cap)}
              onCheckedChange={() => toggle(role._id, cap)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
```

> If `components/ui/switch.tsx` does not exist, run `cd apps/web && npx shadcn@latest add switch` (commit with this task). If `Select` is imported under a different path in this repo, match the import used elsewhere in `RolesPanel.tsx`/`MembersPanel.tsx`.

- [ ] **Step 2: Wire it into `RolesPanel.tsx`**

Wrap the existing `<table>` (lines 77-146) so it only shows on `md+`, and render the mobile component below it. Find the JSX that contains the table and change:

```tsx
{/* before: the bare table */}
<div className="overflow-x-auto">
  <table className="...">...</table>
</div>
```

to:

```tsx
<>
  <div className="hidden md:block overflow-x-auto">
    <table className="...">...</table>
  </div>
  <RolesPanelMobile
    roles={roles}
    capabilities={CAPABILITIES /* the same list the table body maps over */}
    edited={edited}
    toggle={toggle}
    isDirty={isDirty}
    saveRole={saveRole}
  />
</>
```

Add the import: `import { RolesPanelMobile } from './RolesPanelMobile'`.
Use the exact capability source already iterated in the table body (do not invent a new one). The mobile component handles its own `md:hidden`.

- [ ] **Step 3: Build**

Run: `cd apps/web && pnpm build`
Expected: PASS.

- [ ] **Step 4: Manual check**

At 375px: a role dropdown + Save + a vertical list of capability toggles; no horizontal scroll. Toggling then Save persists (same mutation as desktop). At ≥768px: the original matrix table, unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/RolesPanelMobile.tsx apps/web/components/admin/RolesPanel.tsx apps/web/components/ui/switch.tsx
git commit -m "feat(web): mobile role-permission editor (selector + toggles)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Admin Members — touch targets + verify mobile cards

**Files:**
- Modify: `apps/web/components/admin/MembersPanel.tsx:89-110` (member card list) and the edit dialog (lines 112-174).

**Interfaces:**
- Consumes: `.tap` (Task 1). (MembersPanel is already a card list, so no `ResponsiveTable` is needed; this task just hardens it for touch and routes its dialog through `ResponsiveModal` in Task 10.)

- [ ] **Step 1: Add `.tap` to the per-member edit button**

In the member card row (lines 89-110), add `tap` to the edit icon button's className so it meets 44×44 on mobile.

- [ ] **Step 2: Ensure the card row wraps on narrow widths**

Confirm the member card uses `flex items-center gap-3 min-w-0` with the name/email block as `min-w-0 flex-1 truncate` so long emails don't overflow at 375px. Add `min-w-0`/`truncate` where missing.

- [ ] **Step 3: Build**

Run: `cd apps/web && pnpm build`
Expected: PASS.

- [ ] **Step 4: Manual check**

At 375px: member rows don't overflow; long emails truncate; edit button is tappable.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/MembersPanel.tsx
git commit -m "feat(web): admin members touch targets + truncation on mobile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Usage dashboard — ResponsiveTable + responsive chart

**Files:**
- Modify: `apps/web/components/admin/usage-dashboard-parts.tsx` — `PerModelCostTable` (143-177), `TopUsersTable` (182-212), `DailyBarChart` (54-139).

**Interfaces:**
- Consumes: `ResponsiveTable`/`ResponsiveColumn` (Task 3).

- [ ] **Step 1: Convert `PerModelCostTable` to `ResponsiveTable`**

Replace the raw `<table>` with:

```tsx
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'

// row type matches the existing data: { model, inputTokens, outputTokens, requestCount, costUsd }
const columns: ResponsiveColumn<PerModelRow>[] = [
  { key: 'model', header: 'Model', primary: true },
  { key: 'inputTokens', header: 'Input', render: (r) => r.inputTokens.toLocaleString() },
  { key: 'outputTokens', header: 'Output', render: (r) => r.outputTokens.toLocaleString() },
  { key: 'requestCount', header: 'Requests', render: (r) => r.requestCount.toLocaleString() },
  { key: 'costUsd', header: 'Cost', render: (r) => `$${r.costUsd.toFixed(2)}` },
]

return (
  <ResponsiveTable
    columns={columns}
    rows={rows}
    getRowKey={(r) => r.model}
    empty="No usage yet"
  />
)
```

Use the exact field names already in the component (`inputTokens`, `outputTokens`, `requestCount`, `costUsd`) and the existing `PerModelRow`/row type — read the file to confirm before editing. Keep number formatting consistent with whatever the current cells use.

- [ ] **Step 2: Convert `TopUsersTable` to `ResponsiveTable`**

```tsx
// row: { displayName, totalTokens, requestCount, estimatedCostUsd }
const columns: ResponsiveColumn<TopUserRow>[] = [
  { key: 'displayName', header: 'User', primary: true },
  { key: 'totalTokens', header: 'Tokens', render: (r) => r.totalTokens.toLocaleString() },
  { key: 'requestCount', header: 'Requests', render: (r) => r.requestCount.toLocaleString() },
  { key: 'estimatedCostUsd', header: 'Cost', render: (r) => `$${r.estimatedCostUsd.toFixed(2)}` },
]

return (
  <ResponsiveTable
    columns={columns}
    rows={rows}
    getRowKey={(r) => r.displayName}
    empty="No users yet"
  />
)
```

- [ ] **Step 3: Make `DailyBarChart` responsive + add a summary line**

The chart already scales by `dpr` via `getBoundingClientRect()` (lines 73-78) but only redraws on data change. Add a `ResizeObserver` so it redraws on width change, reduce x-axis label density on narrow widths, and render a summary line above the canvas.

Inside the component, change the draw `useEffect` to also observe resize:

```tsx
useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas) return
  const draw = () => {
    /* ...existing draw body (lines 73-113), but when labeling the x-axis,
       only render a label every Nth day so they don't overlap:
         const rect = canvas.getBoundingClientRect()
         const step = rect.width < 480 ? Math.ceil(days.length / 6) : 1
         days.forEach((d, i) => { if (i % step !== 0) return; /* draw label */ })
    */
  }
  draw()
  const ro = new ResizeObserver(draw)
  ro.observe(canvas)
  return () => ro.disconnect()
}, [/* existing data deps */])
```

Above the `<canvas>` (line 126), add a summary so numbers are legible even when the plot is dense:

```tsx
<div className="mb-2 text-sm text-muted-foreground">
  Total: {total.toLocaleString()} tokens · Peak {peakLabel}
</div>
```

Compute `total` and `peakLabel` from the same `days` data the chart already uses (sum of token counts; the day with the max). If those values are already computed elsewhere in the component, reuse them.

- [ ] **Step 4: Build**

Run: `cd apps/web && pnpm build`
Expected: PASS.

- [ ] **Step 5: Manual check**

At 375px: per-model and top-users tables render as cards (label : value), no horizontal scroll; the chart fills width without overlapping labels and shows the summary line. At ≥768px: tables look as before.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin/usage-dashboard-parts.tsx
git commit -m "feat(web): usage tables to ResponsiveTable + responsive chart

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Route modals through `ResponsiveModal`

**Files:**
- Modify: `apps/web/components/chat/NewConversationModal.tsx`
- Modify: `apps/web/components/chat/WallpaperPickerModal.tsx`
- Modify: `apps/web/components/chat/UserProfileDrawer.tsx`
- Modify: `apps/web/components/admin/MembersPanel.tsx` (edit dialog, lines 112-174)

**Interfaces:**
- Consumes: `ResponsiveModal` (Task 4).

> These currently use `Dialog`. Their prop shapes (from the survey): `NewConversationModal({ open, onClose, defaultTab })`, `WallpaperPickerModal({ conversationId, open, onClose })`, `UserProfileDrawer({ userId, onClose })` (open when `userId !== null`). Convert each `Dialog`+`DialogContent` to `ResponsiveModal`, mapping `onClose` to `onOpenChange={(o) => { if (!o) onClose() }}`. Keep the inner body (tabs, forms, lists) unchanged.

- [ ] **Step 1: NewConversationModal**

Replace the `Dialog`/`DialogContent`/`DialogHeader` wrapper with:

```tsx
<ResponsiveModal
  open={open}
  onOpenChange={(o) => { if (!o) onClose() }}
  title={/* existing DialogTitle content */}
>
  {/* existing body: tabs (direct/group), search, list */}
</ResponsiveModal>
```

Import: `import { ResponsiveModal } from '@/components/ui/responsive-modal'`. Remove now-unused `Dialog*` imports.

- [ ] **Step 2: WallpaperPickerModal**

Same conversion. The thumbnail grid stays; ensure the grid is `grid-cols-3 sm:grid-cols-4` so it fits 375px.

- [ ] **Step 3: UserProfileDrawer**

It opens when `userId !== null`. Convert to:

```tsx
<ResponsiveModal
  open={userId !== null}
  onOpenChange={(o) => { if (!o) onClose() }}
  title={/* existing title */}
>
  {/* existing profile body */}
</ResponsiveModal>
```

- [ ] **Step 4: MembersPanel edit dialog**

Convert the edit `Dialog` (lines 112-174) to `ResponsiveModal` driven by the existing `open`/`setOpen` state: `open={open} onOpenChange={setOpen}`. Keep the role `Select` + department checkboxes body and the submit footer.

- [ ] **Step 5: Build**

Run: `cd apps/web && pnpm build`
Expected: PASS.

- [ ] **Step 6: Manual check**

At 375px each of the four opens as a bottom sheet (full width, scrolls, clears safe area); at desktop each is a centered dialog. Forms submit exactly as before.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/chat/NewConversationModal.tsx apps/web/components/chat/WallpaperPickerModal.tsx apps/web/components/chat/UserProfileDrawer.tsx apps/web/components/admin/MembersPanel.tsx
git commit -m "feat(web): route modals through ResponsiveModal (sheet on mobile)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Bottom-padding cleanup + real-device checklist

**Files:**
- Modify (replace ad-hoc bottom padding with `pb-tabbar`/`md:pb-*`):
  - `apps/web/app/(main)/friends/page.tsx` (`pb-20 md:pb-6`)
  - `apps/web/app/(main)/explore/page.tsx` (`pb-20 md:pb-4`)
  - `apps/web/app/(main)/settings/page.tsx` (`pb-24 md:pb-12`)
  - `apps/web/app/(main)/integrations/page.tsx` (`pb-24 md:pb-6`)
  - `apps/web/app/(main)/ai-hub/page.tsx` (`pb-24 md:pb-12`)
  - `apps/web/app/(main)/skills/page.tsx` (`pb-24 md:pb-6`)
  - `apps/web/app/(main)/help/page.tsx` (`pb-24 md:pb-12`)
  - `apps/web/components/admin/AdminShell.tsx` (`pb-24 md:pb-6`)
  - `apps/web/components/profile/ProfileForm.tsx` (`pb-24 md:pb-10`)

**Interfaces:**
- Consumes: `.pb-tabbar` (Task 1).

- [ ] **Step 1: Replace each mobile bottom-padding hack**

In each file above, replace the mobile bottom padding token (`pb-20` or `pb-24`) with `pb-tabbar`, keeping the existing `md:pb-*` reset. Example (friends):

```diff
- className="... p-6 pb-20 md:pb-6 ..."
+ className="... p-6 pb-tabbar md:pb-6 ..."
```

`pb-tabbar` = `calc(4rem + env(safe-area-inset-bottom))` — exactly the tab bar height + safe area, replacing the guessed 80/96px values with one consistent rule. Locate the exact class string with:
`grep -rn "pb-20\|pb-24" apps/web/app apps/web/components` and edit each hit listed above. Leave the sidebar `pb-16` in `app/(main)/layout.tsx:390` as-is (it reserves for the tab bar inside the scroll area and is already correct at 4rem).

- [ ] **Step 2: Build**

Run: `cd apps/web && pnpm build`
Expected: PASS.

- [ ] **Step 3: Manual check**

At 375px each listed page scrolls with the last item clearing the tab bar by a consistent amount; at ≥768px padding resets and there's no dead space.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): consistent pb-tabbar bottom spacing on list pages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Real-device verification (owner)**

Build/preview and open on a real phone (the issues below cannot be confirmed in DevTools). Confirm each:
  - Notch/safe-area: chat input bar and tab bar sit above the home indicator (`pb-safe`).
  - Keyboard: opening the keyboard in a conversation keeps the composer visible (not covered/pushed off).
  - No `100dvh` overshoot hiding the composer when the browser chrome shows/hides.
  - Header `⋮` menu, role toggles, usage cards, and bottom-sheet modals all operate by touch.
  - Pinch-zoom still works (accessibility — not disabled).

---

## Self-Review

**Spec coverage:**
- §3.1 Foundation → Task 1 (utilities, viewport-fit) + Task 5/Task 11 (apply pb-safe/pb-tabbar). `.h-app` dropped — shell already uses native `h-dvh` (documented in plan preamble); covered.
- §3.2 ResponsiveTable → Task 3 (build) + Task 9 (apply). MembersPanel reclassified as already-card → Task 8 (no table conversion needed); consistent with spec intent.
- §3.3 Roles mobile view → Task 7.
- §3.4 ChartCard/responsive canvas → Task 9 Step 3 (ResizeObserver + label density + summary). Implemented inline in `DailyBarChart` rather than a separate `ChartCard` file since it's the only chart — noted; no separate file needed (YAGNI).
- §3.5 ResponsiveModal → Task 4 (build) + Task 10 (apply to NewConversation, Wallpaper, UserProfile, member edit). Emoji/sticker picker conversion was marked nice-to-have during planning and is intentionally deferred (it already has `max-w-[calc(100vw-1rem)]`); called out here so it isn't a silent gap.
- §3.6 Chat real-device → Task 5 (input safe-area/tap) + Task 6 (header overflow) + Task 11 Step 5 (keyboard/dvh real-device check). Shell already `h-dvh`.
- §3.7 Padding cleanup → Task 11.

**Placeholder scan:** No "TBD/TODO/implement later". Where a task says "read the file to confirm the exact type/field names" it is because the consumer must match existing repo types — the code shown is complete against the surveyed field names; this is verification, not a deferred decision.

**Type consistency:** `ResponsiveColumn<T>`/`ResponsiveTable<T>` defined in Task 3 and consumed with the same names in Task 9. `useIsMobile` defined Task 2, consumed Tasks 4 & 6. `ResponsiveModal` props (`open`, `onOpenChange`, `title`, `description`, `children`, `footer`, `className`) defined Task 4, consumed Task 10. `toggle`/`isDirty`/`saveRole` names match the surveyed `RolesPanel.tsx` handlers, passed to `RolesPanelMobile` in Task 7.

**Deferred (explicit, not silent):** Emoji/sticker picker → bottom sheet (low value; already viewport-capped). Can be a follow-up if desired.
