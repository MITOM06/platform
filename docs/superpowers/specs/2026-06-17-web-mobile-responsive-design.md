# Web Mobile Responsive Design Spec
**Date:** 2026-06-17  
**Branch:** chore/qc-2-hidden-bug-sweep  
**Status:** Approved

---

## Problem

The web app has no mobile navigation pattern. On small screens (< 768px):
- Users navigating to Friends/Settings/Profile must go through the dropdown menu in the sidebar header — which disappears once a conversation is open
- No bottom tab bar means switching sections is cumbersome on mobile
- Several pages have insufficient touch target sizes and missing mobile-specific back navigation
- The ConversationHeader action buttons are too small for touch

---

## Approach

**Bottom Tab Bar + Mobile-First Page Polish**

Add a sticky bottom tab bar visible only on mobile (`md:hidden`) covering the four main sections. Each tab routes to an existing page. Inner pages get mobile header improvements. No new routing, no new state management — purely layout and navigation additions.

---

## Components & Changes

### 1. New Component: `components/layout/MobileTabBar.tsx`

A sticky bottom nav bar rendered only on `< md` viewports.

**Tabs (4):**
| Tab | Icon | Route |
|-----|------|-------|
| Chat | `MessageSquare` | `/conversations` |
| Friends | `Users` | `/friends` |
| Explore | `Compass` | `/explore` |
| Settings | `Settings` | `/settings` |

**Behavior:**
- Uses `usePathname()` to determine active tab — highlights the tab whose route prefix matches
- Active tab: full-opacity icon + label, colored with `text-primary`
- Inactive tab: `text-muted-foreground`
- Height: `h-16` (64px) with `safe-area-inset-bottom` padding via `pb-safe` or inline padding for iOS notch
- Background: `bg-background/95 backdrop-blur-md border-t`

**Props:** None — self-contained, reads pathname internally.

---

### 2. Modified: `app/(main)/layout.tsx`

- Import and render `<MobileTabBar />` at the bottom of the root `div`
- Add `pb-16 md:pb-0` to the `<aside>` so conversation list is not hidden behind tab bar on mobile
- Add `pb-16 md:pb-0` to `<main>` for the same reason
- The existing `isConversationOpen` hide/show logic for sidebar and main is preserved exactly as-is

---

### 3. Modified: `app/(main)/friends/page.tsx`

- Add a mobile-only header `div` (`md:hidden`) at the top with the PON logo or "Friends" title and proper padding — mirrors the sidebar header height (`h-16`) so the page has a consistent top bar on mobile
- Ensure tab/button rows have `min-h-[44px]` touch targets on action buttons (Accept, Decline, Remove, Add)
- Input field for search: `h-11` minimum

---

### 4. Modified: `app/(main)/settings/page.tsx`

- Add a mobile-only sticky header (`md:hidden`) with `h-14` height, "Settings" title
- `SettingsCard` components already use `rounded-xl` — verify padding is `px-4` minimum on mobile
- Ensure the user avatar section at top has sufficient padding (`pt-6 pb-4`) on mobile

---

### 5. Modified: `app/(main)/profile/page.tsx`

- Already has `ArrowLeft` back button via `Link` — verify it's visible on mobile (not hidden by any `hidden md:block` class)
- Add `pb-24 md:pb-8` to the scrollable form area so Save button is not hidden behind tab bar

---

### 6. Modified: `components/chat/ConversationHeader.tsx`

- Action buttons (`Phone`, `Video`, `Settings`) change from default `size="icon"` (32×32px) to `className="h-9 w-9"` on mobile — use `sm:h-8 sm:w-8`
- `ArrowLeft` back button: wrap in a `div` with `p-2 -ml-2` to expand touch target without changing visual size

---

### 7. Modified: `app/(main)/explore/page.tsx` (if exists) or `PublicChannelsModal`

- Verify the explore page/modal renders usably on mobile — cards should be full-width, not a fixed pixel grid

---

## Out of Scope

- Redesigning any page's content or feature set
- Adding new routes or API calls
- Changing any desktop layout
- Modifying auth pages (`(auth)/`)

---

## Acceptance Criteria

- [ ] On a 375px wide viewport (iPhone SE), all four main sections are reachable via the bottom tab bar
- [ ] The bottom tab bar does not overlap conversation content or form inputs
- [ ] ConversationHeader back button and action buttons have ≥ 44px touch target
- [ ] Friends page action buttons (Accept/Decline/Add) have ≥ 44px touch target
- [ ] Settings and Profile pages are scrollable without UI elements clipped off-screen
- [ ] Desktop layout (≥ 768px) is unchanged
- [ ] No TypeScript errors (`pnpm build` passes)
