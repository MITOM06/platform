# UX Improvements Plan
Date: 2026-06-29

## Requests

A. Web: Resizable conversation sidebar (drag handle with min/max)
B. Web: Conversation tabs (Chats / Archive / Requests) move to bottom on mobile + merge New button
C. Flutter: All remaining bottom-up SnackBars → top banner
D. Flutter: Remove duplicate "create group" AppBar button + move tab bar to bottom with New button

---

## Part A — Web: Resizable Sidebar

### Task 1 — Add drag-resize handle to sidebar
**File:** `apps/web/app/(main)/layout.tsx`

**Current:** `<aside className="w-full md:w-72 ...">` — fixed 288px on desktop, can't resize.

**Goal:** User can drag the right edge of the sidebar to resize it.
- Min width: **68px** (just enough to show avatar column — `size-10` = 40px + ~14px padding each side)
- Max width: **80% of viewport width** (`0.8 * window.innerWidth`)
- Default: **288px** (same as current `w-72`)
- Persist to `localStorage` key `'pon-sidebar-width'`

**Implementation — add to `MainLayout`:**

```tsx
const [sidebarWidth, setSidebarWidth] = useState(288)

// Restore persisted width on mount
useEffect(() => {
  const stored = localStorage.getItem('pon-sidebar-width')
  if (stored) {
    const w = parseInt(stored, 10)
    if (!isNaN(w) && w >= 68 && w <= window.innerWidth * 0.8) {
      setSidebarWidth(w)
    }
  }
}, [])

// Drag state (ref-based so it doesn't trigger re-renders mid-drag)
const isDragging = useRef(false)
const dragStartX = useRef(0)
const dragStartWidth = useRef(0)

const handleDragStart = (e: React.MouseEvent) => {
  e.preventDefault()
  isDragging.current = true
  dragStartX.current = e.clientX
  dragStartWidth.current = sidebarWidth

  const onMove = (ev: MouseEvent) => {
    if (!isDragging.current) return
    const delta = ev.clientX - dragStartX.current
    const next = Math.min(
      Math.max(dragStartWidth.current + delta, 68),
      window.innerWidth * 0.8,
    )
    setSidebarWidth(next)
  }
  const onUp = () => {
    isDragging.current = false
    localStorage.setItem('pon-sidebar-width', String(sidebarWidth))
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
```

> **Note:** `onUp` captures `sidebarWidth` from closure before it finishes updating. Use a `useRef` to track the latest width in `onMove` and persist that on `onUp`:

```tsx
const currentWidth = useRef(sidebarWidth)
// In onMove: currentWidth.current = next; setSidebarWidth(next)
// In onUp: localStorage.setItem('pon-sidebar-width', String(currentWidth.current))
```

**Change `aside` element:**

```tsx
<aside
  className={cn(
    'w-full border-r flex-col shrink-0 relative overflow-hidden',
    isConversationOpen ? 'hidden md:flex' : 'flex',
  )}
  style={{ width: `${sidebarWidth}px` }}
  // Override: md:w-72 removed, use inline style on md+ only
>
```

On mobile (`< md`) the aside is still full-width — use Tailwind to apply inline width only on `md+`:

```tsx
// Use a CSS variable and media query approach, or just let mobile be full-width:
<aside
  className={cn(
    'w-full md:flex-none border-r flex-col shrink-0 relative overflow-hidden',
    isConversationOpen ? 'hidden md:flex' : 'flex',
  )}
  style={{ ['--sidebar-w' as string]: `${sidebarWidth}px` }}
>
```

Actually simpler: apply inline width only on md+ with a `hidden md:block` wrapper approach is complex. Best: use the inline style always but override on mobile with a class:

```tsx
<aside
  className={cn(
    'w-full md:w-[var(--sidebar-w)] border-r flex-col shrink-0 relative overflow-hidden',
    isConversationOpen ? 'hidden md:flex' : 'flex',
  )}
  style={{ '--sidebar-w': `${sidebarWidth}px` } as React.CSSProperties}
>
```

This uses a CSS variable — `md:w-[var(--sidebar-w)]` applies the dynamic width only on desktop while mobile stays `w-full`.

**Add drag handle div (right edge of aside, desktop only):**

```tsx
{/* Drag handle — right edge, desktop only */}
<div
  onMouseDown={handleDragStart}
  className="hidden md:block absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20 hover:bg-primary/20 active:bg-primary/40 transition-colors"
  title="Drag to resize"
/>
```

This is a 4px wide invisible-ish strip on the right border. On hover it shows a subtle accent color.

---

## Part B — Web: Conversation Tabs Move to Bottom on Mobile

### Task 2 — Restructure ConversationList for mobile bottom tabs
**File:** `apps/web/components/chat/ConversationList.tsx`

**Goal:** On mobile, the tab bar (Chats / Archive / Requests) appears at the BOTTOM of the aside (like a mobile bottom nav), plus a "+ New" button in the same row. On desktop, tabs remain at the top (compact grid, same as today).

**Strategy:**
- Move `<TabsList>` to the DOM **after** all `<TabsContent>` elements
- Wrap it in a `div` with `order-last md:order-first` in the `flex-col` Tabs container
- On mobile: style as a bottom bar (`h-14 border-t bg-background/95`)
- On desktop: style as compact top grid (unchanged from current)
- Add `<button>` for "+ New" inside the wrapper, visible only on mobile

**New `Tabs` structure (from line 158 onward):**

```tsx
<Tabs defaultValue="chats" className="flex flex-col flex-1 min-h-0">

  {/* ── Tab content panels — flex-1 each, fill space between search and tab bar ── */}
  <TabsContent value="chats"
    className="flex-1 overflow-y-auto px-2 pb-2 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
    {/* ... existing chats content unchanged ... */}
  </TabsContent>

  <TabsContent value="archived"
    className="flex-1 overflow-y-auto px-2 pb-2 mt-0">
    <ArchivedConversationList searchQuery={search} />
  </TabsContent>

  <TabsContent value="requests"
    className="flex-1 overflow-y-auto px-2 pb-2 mt-0">
    {/* ... existing requests content unchanged ... */}
  </TabsContent>

  {/* ── Tab bar ── Desktop: compact at top; Mobile: full-height at bottom ── */}
  <div className="shrink-0 order-last md:order-first
                  border-t md:border-t-0 md:border-b
                  bg-background/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none"
       style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

    <div className="flex items-stretch h-14 md:h-auto md:px-3 md:py-1.5">

      {/* TabsList — 3 triggers */}
      <TabsList className="flex-1 flex md:grid md:grid-cols-3 rounded-none md:rounded-md
                           h-full md:h-auto bg-transparent md:bg-muted gap-0 md:gap-0 p-0 md:p-1">
        <TabsTrigger value="chats"
          className="flex-1 flex-col md:flex-row gap-0.5 md:gap-1 text-[10px] md:text-xs
                     h-full md:h-auto rounded-none md:rounded-sm px-2">
          <MessageSquare className="size-5 md:size-3.5 shrink-0" />
          <span>{t('tabChats')}</span>
        </TabsTrigger>

        <TabsTrigger value="archived"
          className="flex-1 flex-col md:flex-row gap-0.5 md:gap-1 text-[10px] md:text-xs
                     h-full md:h-auto rounded-none md:rounded-sm px-2">
          <Archive className="size-5 md:size-3.5 shrink-0" />
          <span>{t('tabArchived')}</span>
        </TabsTrigger>

        <TabsTrigger value="requests"
          className="flex-1 flex-col md:flex-row gap-0.5 md:gap-1 text-[10px] md:text-xs
                     h-full md:h-auto rounded-none md:rounded-sm px-2">
          <UserX className="size-5 md:size-3.5 shrink-0" />
          <span className="relative">
            {t('tabRequests')}
            <RequestsBadge count={requestCount} />
          </span>
        </TabsTrigger>
      </TabsList>

      {/* "+ New" — MOBILE ONLY (desktop has the + button in sidebar header) */}
      <button
        onClick={() => openNewChat('direct')}
        className="md:hidden flex flex-col items-center justify-center gap-0.5 px-4
                   text-muted-foreground hover:text-foreground transition-colors
                   border-l border-border"
        title={t('newConversation')}
      >
        <MessageSquarePlus className="size-5 shrink-0" />
        <span className="text-[10px]">{t('new')}</span>
      </button>

    </div>
  </div>

</Tabs>
```

**Add missing i18n keys** (if not present in translation files):
- `'new'` → "Mới"
- `'newConversation'` → "Cuộc trò chuyện mới"

**Also add `MessageSquarePlus` to imports** in `ConversationList.tsx`.

### Task 3 — Hide generic MobileTabBar on conversations area
**File:** `apps/web/app/(main)/layout.tsx`

**Current:** `const showTabBar = !isConversationOpen` — MobileTabBar shows on conversation LIST.

**Change:** Hide MobileTabBar on the whole messaging area (conversation list AND open thread):

```tsx
// Before:
const showTabBar = !isConversationOpen

// After: hide entirely on messaging area — conversation list has its own bottom bar
const showTabBar = !isMessagingArea
```

Also, the `pb-16 md:pb-0` on the aside's inner div can stay — it provides bottom padding so conversation list items don't hide behind the tabs bar. No change needed there.

> **Note**: With `showTabBar = !isMessagingArea`, the generic nav (Chat / Friends / Explore / Settings) is hidden when on any `/conversations*` route. Users navigate away via the sidebar icons (Explore, Friends) or back button on mobile. This is intentional — the conversations area is its own full-screen shell on mobile.

---

## Part C — Flutter: Replace Remaining SnackBars with Top Banner

### Task 4 — Replace all remaining `ScaffoldMessenger.showSnackBar` calls
**Files:** 4 files

Flutter's `global_messenger.dart` already has `showInfoSnackBar()` and `showErrorSnackBar()` which display from the top. But these 6 call-sites still use the old bottom SnackBar.

**`apps/client/lib/features/settings/ui/security_settings_screen.dart` (line ~172):**

Replace:
```dart
ScaffoldMessenger.of(context).showSnackBar(
  SnackBar(content: Text(...)),
);
```
With:
```dart
showInfoSnackBar(...);   // or showErrorSnackBar(...) depending on context
```

**`apps/client/lib/features/settings/ui/widgets/change_password_dialog.dart` (line ~95):**

Replace:
```dart
ScaffoldMessenger.of(context).showSnackBar(
  SnackBar(content: Text(context.l10n.passwordChangedSuccess)),
);
```
With:
```dart
showInfoSnackBar(context.l10n.passwordChangedSuccess);
```

**`apps/client/lib/features/settings/ui/widgets/settings_avatar_section.dart` (line ~38):**

Replace:
```dart
ScaffoldMessenger.of(context).showSnackBar(
  SnackBar(content: Text(context.l10n.uploadFailed)),
);
```
With:
```dart
showErrorSnackBar(context.l10n.uploadFailed);
```

**`apps/client/lib/features/chat/ui/group_info_screen.dart` (lines ~231, ~250, ~296):**

Replace each:
```dart
ScaffoldMessenger.of(context).showSnackBar(
  SnackBar(content: Text(context.l10n.listGenericError)),
);
```
With:
```dart
showErrorSnackBar(context.l10n.listGenericError);
```
And for uploadFailed:
```dart
showErrorSnackBar(context.l10n.uploadFailed);
```

**Import to add** (where missing): `import '../../../core/utils/global_messenger.dart';`

---

## Part D — Flutter: AppBar Cleanup + Bottom Tab Bar

### Task 5 — Remove duplicate "create group" button from AppBar
**File:** `apps/client/lib/features/chat/ui/conversation_list_screen.dart`

**Remove** this `IconButton` from the `actions` list (lines ~112-116):
```dart
// DELETE THIS:
IconButton(
  icon: const Icon(Icons.group_add_outlined),
  tooltip: context.l10n.createGroup,
  onPressed: () => context.push('/new-group'),
),
```

Creating a group will still be accessible via `/new-conversation` (the FAB, which will be replaced by a bottom bar button in Task 6).

### Task 6 — Replace FAB + top TabBar with bottom tab bar (mobile)
**File:** `apps/client/lib/features/chat/ui/conversation_list_screen.dart`

**Current:**
- `floatingActionButton`: pink FAB → opens `/new-conversation`
- `_ConversationTabs._build()`: `DefaultTabController` → `Column(children: [TabBar(...), TabBarView(...)])`
- `TabBar` sits at the TOP of `_ConversationTabs`

**Goal:** Remove FAB. Remove `TabBar` from top. Add custom bottom bar with 3 tab buttons + new conversation button.

**Step 1 — Remove `floatingActionButton` from `Scaffold`** (lines ~159-188):

Delete the entire `floatingActionButton:` parameter and its `Container/FloatingActionButton` tree.

**Step 2 — Remove `TabBar` from `_ConversationTabs`:**

Inside `_ConversationTabs.build()`, the `Column` has `[TabBar(...), Expanded(child: TabBarView(...))]`. Remove the `TabBar(...)` child — keep only `Expanded(child: TabBarView(...))`:

```dart
// In _ConversationTabs.build():
return DefaultTabController(
  length: 3,
  child: Column(
    children: [
      // REMOVED: TabBar(...) — now in bottom bar
      Expanded(
        child: TabBarView(
          children: [
            ChatsTab(convsAsync: convsAsync, currentUserId: currentUserId, isDark: isDark),
            ArchivedTab(convsAsync: convsAsync, currentUserId: currentUserId, isDark: isDark),
            RequestsTab(convsAsync: convsAsync, currentUserId: currentUserId, isDark: isDark),
          ],
        ),
      ),
    ],
  ),
);
```

But wait: the `DefaultTabController` context needs to be accessible in the `bottomNavigationBar`. Since `bottomNavigationBar` and `body` are siblings in `Scaffold`, they share the same ancestor context. Move `DefaultTabController` above `Scaffold`:

```dart
@override
Widget build(BuildContext context) {
  // ... existing setup vars ...

  return DefaultTabController(        // ← MOVED UP, wraps entire Scaffold
    length: 3,
    child: Scaffold(
      appBar: ...,
      bottomNavigationBar: _ConversationBottomBar(
        currentUserId: user?.id ?? '',
        isDark: isDark,
        convsAsync: convsAsync,
        onNewConversation: () async {
          await context.push('/new-conversation');
          ref.read(conversationsNotifierProvider.notifier).refresh();
        },
      ),
      body: Column(
        children: [
          // offline banner, search bar, active friends, assistant entry
          ...
          Expanded(
            child: Stack(
              children: [
                // ambient glow if isDark
                TabBarView(                    // ← was inside _ConversationTabs
                  children: [
                    ChatsTab(...),
                    ArchivedTab(...),
                    RequestsTab(...),
                  ],
                ),
                if (isWeb) const Positioned(left: 0, bottom: 0, child: WebSettingsButton()),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
```

**Step 3 — Create `_ConversationBottomBar` widget:**

```dart
class _ConversationBottomBar extends StatelessWidget {
  final String currentUserId;
  final bool isDark;
  final AsyncValue<List<ConversationModel>> convsAsync;
  final VoidCallback onNewConversation;

  const _ConversationBottomBar({
    required this.currentUserId,
    required this.isDark,
    required this.convsAsync,
    required this.onNewConversation,
  });

  int get _requestCount {
    final all = convsAsync.valueOrNull;
    if (all == null) return 0;
    return all.where((c) {
      final isPendingDm = c.type == 'direct' &&
          c.status == 'pending' &&
          c.createdBy != currentUserId;
      final isPendingGroup = c.pendingMembers.contains(currentUserId);
      return isPendingDm || isPendingGroup;
    }).length;
  }

  @override
  Widget build(BuildContext context) {
    final tabController = DefaultTabController.of(context);
    final l10n = context.l10n;
    final accent = isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary;
    final reqCount = _requestCount;

    return AnimatedBuilder(
      animation: tabController,
      builder: (context, _) {
        final activeIndex = tabController.index;

        return Container(
          decoration: BoxDecoration(
            color: isDark ? AppTheme.darkSurface : Colors.white,
            border: Border(
              top: BorderSide(
                color: isDark
                    ? AppTheme.darkBorder.withValues(alpha: 0.3)
                    : Colors.black.withValues(alpha: 0.08),
                width: 0.5,
              ),
            ),
          ),
          child: SafeArea(
            child: SizedBox(
              height: 56,
              child: Row(
                children: [
                  // Tab 0 — Chats
                  _BottomTabItem(
                    icon: Icons.chat_bubble_outline,
                    label: l10n.tabChats,
                    isActive: activeIndex == 0,
                    accent: accent,
                    onTap: () => tabController.animateTo(0),
                    isDark: isDark,
                  ),
                  // Tab 1 — Archived
                  _BottomTabItem(
                    icon: Icons.archive_outlined,
                    label: l10n.tabArchived,
                    isActive: activeIndex == 1,
                    accent: accent,
                    onTap: () => tabController.animateTo(1),
                    isDark: isDark,
                  ),
                  // Tab 2 — Requests (with badge)
                  _BottomTabItem(
                    icon: Icons.person_add_outlined,
                    label: l10n.tabRequests,
                    isActive: activeIndex == 2,
                    accent: accent,
                    onTap: () => tabController.animateTo(2),
                    isDark: isDark,
                    badge: reqCount,
                  ),
                  // New conversation button
                  _BottomTabItem(
                    icon: Icons.add_comment_outlined,
                    label: l10n.tooltipNewConversation,
                    isActive: false,
                    accent: isDark ? AppTheme.ponPink : Theme.of(context).colorScheme.secondary,
                    onTap: onNewConversation,
                    isDark: isDark,
                    isAction: true,   // accent-colored icon even when not "active tab"
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _BottomTabItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final Color accent;
  final VoidCallback onTap;
  final bool isDark;
  final int badge;
  final bool isAction;

  const _BottomTabItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.accent,
    required this.onTap,
    required this.isDark,
    this.badge = 0,
    this.isAction = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = (isActive || isAction)
        ? accent
        : (isDark ? Colors.white54 : Colors.black45);

    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, size: 22, color: color),
                if (badge > 0)
                  Positioned(
                    right: -8,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: isDark ? AppTheme.ponPink : Theme.of(context).colorScheme.secondary,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        badge > 99 ? '99+' : '$badge',
                        style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 10, color: color, fontWeight: isActive ? FontWeight.w600 : FontWeight.normal),
            ),
          ],
        ),
      ),
    );
  }
}
```

**Step 4 — Delete the old `_ConversationTabs` class** (now redundant; its `TabBarView` is inlined into the body `Stack`).

**Step 5 — Update `_requestCount` references:** The request count was previously computed in `_ConversationTabs`. It's now computed in `_ConversationBottomBar`. Remove it from `_ConversationTabs` (or delete the whole class).

---

## Summary of files changed

| File | Change |
|---|---|
| `apps/web/app/(main)/layout.tsx` | Add drag handle, resize state, CSS variable for width; `showTabBar = !isMessagingArea` |
| `apps/web/components/chat/ConversationList.tsx` | Move `TabsList` to DOM bottom with `order-last md:order-first`; add mobile "+ New" button; adjust TabsTrigger styling |
| `apps/client/lib/features/chat/ui/conversation_list_screen.dart` | Remove `group_add` AppBar button; remove FAB; move `DefaultTabController` above `Scaffold`; add `_ConversationBottomBar`; inline `TabBarView` in body; delete `_ConversationTabs` |
| `apps/client/lib/features/settings/ui/security_settings_screen.dart` | `ScaffoldMessenger.showSnackBar` → `showInfoSnackBar` |
| `apps/client/lib/features/settings/ui/widgets/change_password_dialog.dart` | `ScaffoldMessenger.showSnackBar` → `showInfoSnackBar` |
| `apps/client/lib/features/settings/ui/widgets/settings_avatar_section.dart` | `ScaffoldMessenger.showSnackBar` → `showErrorSnackBar` |
| `apps/client/lib/features/chat/ui/group_info_screen.dart` | 3× `ScaffoldMessenger.showSnackBar` → `showErrorSnackBar` |

---

## Checklist for Claude Code

- [ ] Task 1: `layout.tsx` — `sidebarWidth` state, `currentWidth` ref, `handleDragStart` handler, drag handle div, `md:w-[var(--sidebar-w)]` + CSS variable inline style
- [ ] Task 2: `ConversationList.tsx` — restructure `Tabs`, move `TabsList` after `TabsContent`, add `order-last md:order-first` wrapper, mobile "+ New" button, responsive TabsTrigger/TabsList styling
- [ ] Task 3: `layout.tsx` — `showTabBar = !isMessagingArea`
- [ ] Task 4: `conversation_list_screen.dart` — remove `group_add_outlined` IconButton from AppBar actions
- [ ] Task 5: `conversation_list_screen.dart` — move `DefaultTabController` above `Scaffold`, remove FAB, inline `TabBarView` in body Stack, add `_ConversationBottomBar` + `_BottomTabItem` classes, delete `_ConversationTabs`
- [ ] Task 6: Replace all 6× `ScaffoldMessenger.of(context).showSnackBar()` with `showInfoSnackBar`/`showErrorSnackBar` (add import where missing)
- [ ] Verify: sidebar drag works with correct min (68px shows only avatars) and max (80% screen width)
- [ ] Verify: on mobile web, tab bar appears at BOTTOM; on desktop stays at TOP
- [ ] Verify: Flutter bottom bar shows tabs + new button; no FAB; no group_add in AppBar
- [ ] Verify: all Flutter notifications appear from top (no bottom SnackBars remaining)
