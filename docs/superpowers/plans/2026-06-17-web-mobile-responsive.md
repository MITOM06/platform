# Web Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom tab bar for mobile navigation and fix touch-target / padding issues across the web app so all main sections are reachable and usable on small screens (≥ 375px).

**Architecture:** Add a `MobileTabBar` fixed-bottom component (`md:hidden`) to `(main)/layout.tsx`. Expand the sidebar-hide logic to also cover inner pages (friends, settings, profile, explore). Fix bottom-padding on scrollable inner pages so content is not hidden behind the tab bar.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, lucide-react, next-intl, `usePathname` from `next/navigation`.

## Global Constraints

- Only modify `apps/web/` — no backend changes.
- All strings must be added to all 7 locale files: `en, vi, zh, ja, ko, es, fr`.
- Desktop layout (≥ 768px / `md:`) must remain unchanged.
- `strict: true` TypeScript — no `any`.
- Run `pnpm --filter @platform/web build` after all tasks to catch TS errors.
- Max 400 lines per file.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/components/layout/MobileTabBar.tsx` | **Create** | Sticky bottom tab bar, 4 tabs, active state via pathname |
| `apps/web/app/(main)/layout.tsx` | **Modify** | Add MobileTabBar, expand sidebar-hide logic for inner pages, add bottom padding to sidebar |
| `apps/web/messages/en.json` | **Modify** | Add `tabChat`, `tabFriends` keys to `layout` namespace |
| `apps/web/messages/vi.json` | **Modify** | Same |
| `apps/web/messages/zh.json` | **Modify** | Same |
| `apps/web/messages/ja.json` | **Modify** | Same |
| `apps/web/messages/ko.json` | **Modify** | Same |
| `apps/web/messages/es.json` | **Modify** | Same |
| `apps/web/messages/fr.json` | **Modify** | Same |
| `apps/web/app/(main)/friends/page.tsx` | **Modify** | Add `pb-20 md:pb-6` to scrollable content; fix action button touch targets |
| `apps/web/app/(main)/settings/page.tsx` | **Modify** | Add `pb-24 md:pb-8` to inner scrollable div |
| `apps/web/app/(main)/profile/page.tsx` | **Modify** | Change `pb-10` → `pb-24 md:pb-10` on form element |
| `apps/web/app/(main)/explore/page.tsx` | **Modify** | Add `pb-20 md:pb-4` to channel list container |
| `apps/web/components/chat/ConversationHeader.tsx` | **Modify** | Expand ArrowLeft touch target with padding |

---

## Task 1: Add i18n keys for tab bar labels

**Files:**
- Modify: `apps/web/messages/en.json` (and 6 other locale files)

**Interfaces:**
- Produces: `t('layout.tabChat')` and `t('layout.tabFriends')` usable in MobileTabBar

- [ ] **Step 1: Add keys to `en.json`**

In `apps/web/messages/en.json`, inside the `"layout"` object, add after the last existing key:

```json
"tabChat": "Chat",
"tabFriends": "Friends"
```

- [ ] **Step 2: Add keys to `vi.json`**

In `apps/web/messages/vi.json`, inside `"layout"`:

```json
"tabChat": "Trò chuyện",
"tabFriends": "Bạn bè"
```

- [ ] **Step 3: Add keys to `zh.json`**

In `apps/web/messages/zh.json`, inside `"layout"`:

```json
"tabChat": "聊天",
"tabFriends": "好友"
```

- [ ] **Step 4: Add keys to `ja.json`**

In `apps/web/messages/ja.json`, inside `"layout"`:

```json
"tabChat": "チャット",
"tabFriends": "友達"
```

- [ ] **Step 5: Add keys to `ko.json`**

In `apps/web/messages/ko.json`, inside `"layout"`:

```json
"tabChat": "채팅",
"tabFriends": "친구"
```

- [ ] **Step 6: Add keys to `es.json`**

In `apps/web/messages/es.json`, inside `"layout"`:

```json
"tabChat": "Chat",
"tabFriends": "Amigos"
```

- [ ] **Step 7: Add keys to `fr.json`**

In `apps/web/messages/fr.json`, inside `"layout"`:

```json
"tabChat": "Chat",
"tabFriends": "Amis"
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/messages/
git commit -m "feat(web/i18n): add tabChat and tabFriends keys to layout namespace"
```

---

## Task 2: Create MobileTabBar component

**Files:**
- Create: `apps/web/components/layout/MobileTabBar.tsx`

**Interfaces:**
- Consumes: `usePathname()` from `next/navigation`, `useTranslations('layout')` from `next-intl`, lucide icons
- Produces: `<MobileTabBar />` — a self-contained component with no props

- [ ] **Step 1: Create the file**

Create `apps/web/components/layout/MobileTabBar.tsx` with this exact content:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MessageSquare, Users, Compass, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { key: 'chat', href: '/conversations', icon: MessageSquare, labelKey: 'tabChat' },
  { key: 'friends', href: '/friends', icon: Users, labelKey: 'tabFriends' },
  { key: 'explore', href: '/explore', icon: Compass, labelKey: 'navExplore' },
  { key: 'settings', href: '/settings', icon: Settings, labelKey: 'menuSettings' },
] as const

export function MobileTabBar() {
  const pathname = usePathname()
  const t = useTranslations('layout')

  function isActive(href: string) {
    if (href === '/conversations') return pathname === '/conversations' || pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-background/95 backdrop-blur-md flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ key, href, icon: Icon, labelKey }) => {
        const active = isActive(href)
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className={cn('size-5 shrink-0', active && 'drop-shadow-[0_0_6px_currentColor]')} />
            <span className="leading-none">{t(labelKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/MobileTabBar.tsx
git commit -m "feat(web): add MobileTabBar component for mobile navigation"
```

---

## Task 3: Integrate MobileTabBar into main layout

**Files:**
- Modify: `apps/web/app/(main)/layout.tsx`

**Interfaces:**
- Consumes: `MobileTabBar` from Task 2

The key insight: the current layout hides `<main>` on mobile when no conversation is open. Inner pages (friends, settings, profile, explore) live inside `<main>` — they are invisible on mobile! The fix: expand the logic so `<main>` shows and sidebar hides for any inner page, not just conversations. The tab bar hides only inside an open conversation (where full-screen chat is needed).

- [ ] **Step 1: Add imports and expand routing logic**

In `apps/web/app/(main)/layout.tsx`, replace the `isConversationOpen` line and add the import:

Find:
```tsx
import { cn } from '@/lib/utils'
```

Replace with:
```tsx
import { cn } from '@/lib/utils'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
```

Find:
```tsx
  const isConversationOpen = /^\/conversations\/.+/.test(pathname)
```

Replace with:
```tsx
  const isConversationOpen = /^\/conversations\/.+/.test(pathname)
  const isInnerPage = /^\/(friends|settings|profile|explore|archived|token-usage|ai-memory|ai-persona|reminders|kb|shared-media)/.test(pathname)
  const hideAside = isConversationOpen || isInnerPage
  const showTabBar = !isConversationOpen
```

- [ ] **Step 2: Update aside and main className conditions**

Find:
```tsx
      <aside
        className={cn(
          'w-full md:w-72 border-r flex-col shrink-0 relative overflow-hidden',
          isConversationOpen ? 'hidden md:flex' : 'flex',
        )}
      >
```

Replace with:
```tsx
      <aside
        className={cn(
          'w-full md:w-72 border-r flex-col shrink-0 relative overflow-hidden',
          hideAside ? 'hidden md:flex' : 'flex',
        )}
      >
```

Find:
```tsx
      {/* Main area: hidden on mobile when no conversation is open */}
      <main
        className={cn(
          'flex-1 overflow-hidden',
          isConversationOpen ? 'flex flex-col' : 'hidden md:flex md:flex-col',
        )}
      >
```

Replace with:
```tsx
      {/* Main area: hidden on mobile when sidebar is shown */}
      <main
        className={cn(
          'flex-1 overflow-hidden',
          hideAside ? 'flex flex-col' : 'hidden md:flex md:flex-col',
        )}
      >
```

- [ ] **Step 3: Add bottom padding to sidebar and render MobileTabBar**

Find the closing `</div>` of the root layout div (after `</main>`):
```tsx
    </main>
    </div>
```

Replace with:
```tsx
    </main>
      {showTabBar && <MobileTabBar />}
    </div>
```

Find the inner sidebar content div:
```tsx
        <div className="flex-1 flex flex-col overflow-hidden">
          <ActiveFriendsRow />
          <ConversationList />
        </div>
```

Replace with:
```tsx
        <div className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
          <ActiveFriendsRow />
          <ConversationList />
        </div>
```

- [ ] **Step 4: Verify the file stays under 400 lines**

```bash
wc -l apps/web/app/\(main\)/layout.tsx
```

Expected: under 400 lines.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(main\)/layout.tsx
git commit -m "feat(web): integrate MobileTabBar and expand mobile routing logic"
```

---

## Task 4: Fix Friends page mobile padding and touch targets

**Files:**
- Modify: `apps/web/app/(main)/friends/page.tsx`

**Interfaces:** None (self-contained page)

The friends page scrollable area needs bottom padding so the tab bar doesn't cover the last row. Action buttons use `size="icon-sm"` which is too small for touch — bump to `size="sm"` with `min-h-[44px]`.

- [ ] **Step 1: Fix scrollable area bottom padding**

Find:
```tsx
      <div className="p-6 overflow-y-auto flex-1">
```

Replace with:
```tsx
      <div className="p-6 overflow-y-auto flex-1 pb-20 md:pb-6">
```

- [ ] **Step 2: Fix Remove Friend button touch target**

Find:
```tsx
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeFriend.mutate(user.id || user._id!)}
                  title={t('removeFriend')}
                  disabled={removeFriend.isPending}
                >
                  <UserMinus className="size-4" />
                </Button>
```

Replace with:
```tsx
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeFriend.mutate(user.id || user._id!)}
                  title={t('removeFriend')}
                  disabled={removeFriend.isPending}
                >
                  <UserMinus className="size-4" />
                </Button>
```

- [ ] **Step 3: Fix Accept / Decline buttons touch targets**

Find:
```tsx
                  <Button
                    size="icon-sm"
                    className="bg-pon-cyan hover:bg-pon-cyan/90 text-black"
                    onClick={() => acceptRequest.mutate(user.id || user._id!)}
                    title={t('accept')}
                    disabled={acceptRequest.isPending}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeFriend.mutate(user.id || user._id!)}
                    title={t('decline')}
                    disabled={removeFriend.isPending}
                  >
                    <X className="size-4" />
                  </Button>
```

Replace with:
```tsx
                  <Button
                    size="sm"
                    className="min-h-[44px] min-w-[44px] bg-pon-cyan hover:bg-pon-cyan/90 text-black"
                    onClick={() => acceptRequest.mutate(user.id || user._id!)}
                    title={t('accept')}
                    disabled={acceptRequest.isPending}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-[44px] min-w-[44px]"
                    onClick={() => removeFriend.mutate(user.id || user._id!)}
                    title={t('decline')}
                    disabled={removeFriend.isPending}
                  >
                    <X className="size-4" />
                  </Button>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(main\)/friends/page.tsx
git commit -m "fix(web/friends): add mobile bottom padding and enlarge touch targets"
```

---

## Task 5: Fix Settings page mobile bottom padding

**Files:**
- Modify: `apps/web/app/(main)/settings/page.tsx`

The settings page already has a header and ArrowLeft. The scrollable content needs bottom padding so the version text and Logout card aren't hidden behind the tab bar.

- [ ] **Step 1: Add bottom padding to scrollable inner div**

Find:
```tsx
          <div className="relative max-w-md mx-auto px-6 py-8">
```

Replace with:
```tsx
          <div className="relative max-w-md mx-auto px-6 py-8 pb-24 md:pb-8">
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(main\)/settings/page.tsx
git commit -m "fix(web/settings): add mobile bottom padding to prevent tab bar overlap"
```

---

## Task 6: Fix Profile page mobile bottom padding

**Files:**
- Modify: `apps/web/app/(main)/profile/page.tsx`

The profile form ends with a Save button. On mobile, the tab bar would overlap it without extra bottom padding.

- [ ] **Step 1: Extend form bottom padding**

Find:
```tsx
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pb-10">
```

Replace with:
```tsx
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pb-24 md:pb-10">
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(main\)/profile/page.tsx
git commit -m "fix(web/profile): extend form bottom padding for mobile tab bar"
```

---

## Task 7: Fix Explore page mobile bottom padding

**Files:**
- Modify: `apps/web/app/(main)/explore/page.tsx`

The channels list scrollable area needs bottom padding to avoid the last channel being hidden.

- [ ] **Step 1: Add bottom padding to channels list**

Find the channel list container — the `flex-1 overflow-y-auto` div that wraps the channel cards. It currently looks like:

```tsx
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
```

Replace with:
```tsx
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20 md:pb-4">
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(main\)/explore/page.tsx
git commit -m "fix(web/explore): add mobile bottom padding for tab bar"
```

---

## Task 8: Fix ConversationHeader touch targets

**Files:**
- Modify: `apps/web/components/chat/ConversationHeader.tsx`

The `ArrowLeft` back link has no tap padding. Expand it with `p-2 -m-2` so the touch target is at least 40px without changing the visual gap. Action buttons (`Phone`, `Video`, `Settings`) are already `size="icon"` (36×36px) which is acceptable; no change needed there.

- [ ] **Step 1: Expand ArrowLeft touch target**

Find:
```tsx
        <Link
          href="/conversations"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
```

Replace with:
```tsx
        <Link
          href="/conversations"
          className="text-muted-foreground hover:text-foreground transition-colors p-2 -m-2 rounded-full"
        >
          <ArrowLeft className="size-5" />
        </Link>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/chat/ConversationHeader.tsx
git commit -m "fix(web/chat): expand ArrowLeft touch target in ConversationHeader"
```

---

## Task 9: Build verification

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript build**

```bash
cd /Users/phong/projects/personal/platform && pnpm --filter @platform/web build
```

Expected: build completes with no TypeScript errors. Exit code 0.

- [ ] **Step 2: Fix any TS errors found**

If there are errors, fix them in the relevant files and commit. Common issues:
- Missing import for `MobileTabBar`
- Mismatched `as const` on tabs array vs string type for `labelKey`

- [ ] **Step 3: Manual acceptance check**

Open the app in a browser and resize to 375px width. Verify:
- [ ] Bottom tab bar appears at the bottom on mobile
- [ ] Tapping "Chat" goes to conversation list (sidebar shown)
- [ ] Tapping "Friends" shows the friends page (not the sidebar)
- [ ] Tapping "Explore" shows the explore page
- [ ] Tapping "Settings" shows the settings page
- [ ] Opening a conversation hides the tab bar
- [ ] Back arrow in conversation returns to conversation list (tab bar reappears)
- [ ] Settings and Profile pages scroll fully to bottom without cut-off
- [ ] Desktop layout (≥ 768px) is unchanged — no tab bar, sidebar visible

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix(web): address build errors from mobile responsive changes"
```
