# Plan: Notification UI + Auth Fixes

> **Ngày:** 2026-07-01  
> **Scope:** Web (Next.js) + Mobile (Flutter)  
> **4 issues độc lập**, mỗi phần có thể implement riêng.

---

## Issue 1 — Nút Đồng ý / Từ chối không biến mất sau khi action

### Root cause

**Web** (`NotificationBell.tsx`): Buttons chỉ check `n.type === 'FRIEND_REQUEST' && n.relatedEntityId` — không check `n.readAt`. Sau khi accept/decline, `markRead.mutate` → refetch → `n.readAt` có giá trị, nhưng buttons vẫn render vì không gate trên `readAt`.

**Mobile** (`notification_panel.dart`): Tương tự — chỉ check `n.isFriendRequest && n.relatedEntityId != null`, không check `n.isUnread`.

### Fix

#### 1a — Web: `components/layout/NotificationBell.tsx`

Trong `NotificationRow`, thêm `!n.readAt` vào điều kiện render buttons:

```tsx
// Trước:
{n.type === 'FRIEND_REQUEST' && n.relatedEntityId && (
  <div className="flex gap-2 mt-2">...</div>
)}

// Sau:
{n.type === 'FRIEND_REQUEST' && n.relatedEntityId && !n.readAt && (
  <div className="flex gap-2 mt-2">...</div>
)}
```

#### 1b — Mobile: `apps/client/lib/features/notifications/ui/notification_panel.dart`

Trong `_NotificationTileState.build()`, thêm `n.isUnread`:

```dart
// Trước:
if (n.isFriendRequest && n.relatedEntityId != null) ...[
  // buttons
]

// Sau:
if (n.isFriendRequest && n.relatedEntityId != null && n.isUnread) ...[
  // buttons
]
```

---

## Issue 2 — Tách notification thành 2 section: Chưa xem / Đã xem

### Thiết kế

```
┌─────────────────────────────┐
│ 🔔 Thông báo      Mark all  │
├─────────────────────────────┤
│ CHƯA XEM (2)                │  ← section header
│ [unread notif 1]            │
│ [unread notif 2]            │
├─────────────────────────────┤
│ ĐÃ XEM                      │  ← section header
│ [read notif 1]              │
│ [read notif 2]              │
└─────────────────────────────┘
```

Nếu không có unread → ẩn section "Chưa xem" (chỉ hiện "Đã xem").  
Nếu không có read → ẩn section "Đã xem" (chỉ hiện "Chưa xem").  
Nếu cả hai đều trống → hiển thị empty state hiện tại.

#### 2a — Web: `components/layout/NotificationBell.tsx`

Trong `NotificationBell`, tách danh sách:

```tsx
const unread = notifications.filter((n) => !n.readAt)
const read = notifications.filter((n) => !!n.readAt)
```

Thay thế render hiện tại bằng:

```tsx
<div className="max-h-96 overflow-y-auto">
  {notifications.length === 0 ? (
    <EmptyState />
  ) : (
    <>
      {unread.length > 0 && (
        <>
          <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/30 border-b">
            {t('sectionUnread')} {unread.length > 0 && `(${unread.length})`}
          </div>
          <div className="divide-y divide-border/50">
            {unread.map((n) => (
              <NotificationRow key={n._id} n={n} ... />
            ))}
          </div>
        </>
      )}
      {read.length > 0 && (
        <>
          <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/30 border-b border-t">
            {t('sectionRead')}
          </div>
          <div className="divide-y divide-border/50">
            {read.map((n) => (
              <NotificationRow key={n._id} n={n} ... />
            ))}
          </div>
        </>
      )}
    </>
  )}
</div>
```

**i18n** — Thêm vào tất cả 7 locale files trong namespace `"notifications"`:

| Locale | `sectionUnread` | `sectionRead` |
|--------|-----------------|---------------|
| en | `"Unread"` | `"Earlier"` |
| vi | `"Chưa xem"` | `"Đã xem"` |
| zh | `"未读"` | `"已读"` |
| ja | `"未読"` | `"既読"` |
| ko | `"읽지 않음"` | `"읽음"` |
| es | `"Sin leer"` | `"Leídas"` |
| fr | `"Non lues"` | `"Lues"` |

#### 2b — Mobile: `apps/client/lib/features/notifications/ui/notification_panel.dart`

Trong `NotificationPanel.build()`, thay đoạn `data: (items) => ...`:

```dart
data: (items) {
  if (items.isEmpty) return _EmptyState(isDark: isDark);

  final unread = items.where((n) => n.isUnread).toList();
  final read = items.where((n) => !n.isUnread).toList();

  return ListView(
    shrinkWrap: true,
    padding: const EdgeInsets.only(bottom: 8),
    children: [
      if (unread.isNotEmpty) ...[
        _SectionHeader(
          label: context.l10n.notificationsSectionUnread,
          count: unread.length,
          isDark: isDark,
        ),
        ...unread.map((n) => _NotificationTile(notification: n)),
        const Divider(height: 1),
      ],
      if (read.isNotEmpty) ...[
        _SectionHeader(
          label: context.l10n.notificationsSectionRead,
          isDark: isDark,
        ),
        ...read.map((n) => _NotificationTile(notification: n)),
      ],
    ],
  );
},
```

Thêm widget `_SectionHeader`:

```dart
class _SectionHeader extends StatelessWidget {
  final String label;
  final int? count;
  final bool isDark;
  const _SectionHeader({required this.label, this.count, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final text = count != null ? '$label ($count)' : label;
    return Container(
      color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.03),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.8,
          color: isDark ? Colors.white38 : Colors.black38,
        ),
      ),
    );
  }
}
```

**i18n** — Thêm vào tất cả 7 ARB files:

```json
"notificationsSectionUnread": "Chưa xem",
"@notificationsSectionUnread": {},
"notificationsSectionRead": "Đã xem",
"@notificationsSectionRead": {}
```

(Tương tự cho 6 locale còn lại — xem bảng ở task 2a)

---

## Issue 3 — Mobile: Google login xong nhảy về trang login thay vì vào chat

### Root cause

`loginWithCode` trong `auth_provider.dart` được gọi đúng và THÀNH CÔNG (evidence: sau đó bấm Register → nhảy vào chat, chứng tỏ `AuthAuthenticated` đã set). Nhưng `GoRouter` không tự redirect vì **`RouterNotifier._listener` có thể là `null` vào thời điểm auth state thay đổi** — race condition giữa deep link handling và GoRouter initialization.

`RouterNotifier` implement `Listenable` thủ công với chỉ 1 slot:
```dart
void addListener(VoidCallback listener) => _listener = listener
```
Nếu GoRouter gọi `addListener` trước khi app state ổn định, hoặc widget tree rebuild khiến GoRouter gọi lại `addListener` sau đó với một listener mới (overwriting cái cũ)... `_listener` có thể bị null hoặc stale tại thời điểm `build()` fires.

### Fix

#### 3a — `apps/client/lib/core/router/app_router.dart`

**Thay `RouterNotifier` bằng `ChangeNotifier` pattern** (robust hơn):

```dart
@riverpod
class RouterNotifier extends _$RouterNotifier with ChangeNotifier implements Listenable {
  @override
  Future<bool> build() async {
    final authValue = ref.watch(authNotifierProvider);
    ref.watch(themeOnboardingNotifierProvider);
    // Dùng microtask để tránh "setState during build" error
    Future.microtask(notifyListeners);
    return authValue.valueOrNull is AuthAuthenticated;
  }

  // ChangeNotifier.addListener/removeListener đã handle multi-listener correctly.
  // KHÔNG cần override addListener/removeListener nữa — xóa chúng đi.
  // KHÔNG cần _listener field nữa — xóa đi.
}
```

Xóa:
- `VoidCallback? _listener;`
- `void addListener(VoidCallback listener) => _listener = listener`
- `void removeListener(VoidCallback listener) { if (_listener == listener) _listener = null }`
- `_listener?.call()` trong `build()`

#### 3b — `apps/client/lib/features/auth/domain/auth_provider.dart`

**Thêm explicit navigation sau khi `loginWithCode` thành công** — belt-and-suspenders:

```dart
Future<void> loginWithCode(String code) async {
  if (_lastProcessedOAuthCode == code) return;
  _lastProcessedOAuthCode = code;
  state = const AsyncLoading();
  state = await AsyncValue.guard(() async {
    final user = await ref.read(authRepositoryProvider).exchangeCode(code);
    _registerFcmToken();
    return AuthAuthenticated(user);
  });

  // Fallback: nếu router listener không fire (race condition), tự navigate
  if (state.valueOrNull is AuthAuthenticated) {
    // Dùng rootNavigatorKey để navigate từ ngoài widget tree
    final context = rootNavigatorKey.currentContext;
    if (context != null && context.mounted) {
      // Delay nhỏ để router listener có cơ hội fire trước
      await Future.delayed(const Duration(milliseconds: 300));
      // Re-check: nếu vẫn ở trang public (login/register), tự redirect
      final router = GoRouter.of(context);
      final location = router.routerDelegate.currentConfiguration.uri.path;
      final onPublic = {'/login', '/register', '/verify-otp'}.contains(location);
      if (onPublic) {
        context.go('/');
      }
    }
  }
}
```

Import cần thêm: `import 'package:go_router/go_router.dart';` và `import '../../core/utils/global_messenger.dart';` (để có `rootNavigatorKey`).

---

## Issue 4 — Web: Banner "No internet" nhấp nháy khi token hết hạn và STOMP reconnect

### Root cause

Trong `OfflineBanner.tsx`:
```tsx
const [isOffline, setIsOffline] = useState(!stompService.isConnected())
```

Khi STOMP đang reconnect (sau token refresh):
1. `onWebSocketClose` fires → `notifyStateChange(false)` → `OfflineBanner.isOffline = true` → banner hiện
2. `beforeConnect` refresh token → STOMP reconnects → `onConnect` fires → `notifyStateChange(true)` → banner ẩn

Toàn bộ cycle này chỉ mất 1–2 giây nhưng đủ để user thấy banner. Đây là transient disconnect, không phải mất mạng thật sự.

### Fix: `apps/web/components/chat/OfflineBanner.tsx`

Thêm debounce 3 giây trước khi hiện banner — chỉ hiện nếu mất kết nối kéo dài > 3s (genuine network loss):

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { stompService } from '@/lib/stomp/client'

// Debounce: only show "offline" banner after this many ms of disconnection.
// Prevents false positives during token-refresh reconnect cycles (~1-2s).
const OFFLINE_DEBOUNCE_MS = 3_000

export function OfflineBanner() {
  const t = useTranslations('chat')
  const [isOffline, setIsOffline] = useState(false) // start hidden — don't flash on mount
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const unsubscribe = stompService.onStateChange((connected) => {
      if (connected) {
        // Reconnected → clear pending debounce and immediately hide banner
        clearTimeout(timerRef.current)
        setIsOffline(false)
      } else {
        // Disconnected → wait before showing banner (avoid reconnect flicker)
        timerRef.current = setTimeout(() => {
          setIsOffline(true)
        }, OFFLINE_DEBOUNCE_MS)
      }
    })
    return () => {
      unsubscribe()
      clearTimeout(timerRef.current)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-2">
      <WifiOff className="size-4 text-red-500 shrink-0" />
      <span className="text-sm font-medium text-red-600 dark:text-red-400">
        {t('offlineBanner')}
      </span>
    </div>
  )
}
```

**Lưu ý**: Initial state là `false` thay vì `!stompService.isConnected()`. Điều này có nghĩa: banner không hiện ngay khi component mount, ngay cả khi STOMP chưa connect. Chỉ sau khi disconnect + 3 giây mới hiện. Đây là behavior đúng vì STOMP connect thường hoàn thành trong < 1s sau page load.

---

## Verification

1. **Issue 1**: Accept friend request → buttons biến mất ngay (không cần reload). Decline → tương tự. Check cả web popover và mobile bottom sheet.
2. **Issue 2**: Mở notification panel với mix of read/unread → thấy 2 section rõ ràng. Không có unread → chỉ thấy section "Đã xem". Empty → thấy empty state.
3. **Issue 3**: Login với Google trên mobile, hoàn tất OAuth → vào đúng chat, không bounce về login. Bật debug log trong `loginWithCode` để confirm exact code path.
4. **Issue 4**: Để app idle 1 giờ (token expire), mở lại → quan sát network tab: STOMP reconnect xảy ra, banner KHÔNG xuất hiện. Tắt mạng thật sự > 3 giây → banner xuất hiện. Bật mạng lại → banner biến mất ngay.

---

## Lưu ý

- Issue 3 fix 3b dùng `rootNavigatorKey` — import từ `global_messenger.dart` (đã có trong project). Nếu không import được, dùng `BuildContext` từ một `ConsumerWidget` hoặc tham chiếu navigator khác.
- Issue 4: debounce 3 giây là conservative. Nếu user vẫn thấy banner blink, tăng lên 5 giây. Nếu muốn hiện sớm hơn khi mất mạng thật, giữ nguyên 3s là hợp lý (STOMP reconnect delay là 5s, nên 3s đủ để phân biệt).
- Issue 2 với `ChangeNotifier`: nếu project đang dùng `Listenable` interface bắt buộc, cần ensure class extend đúng. `ChangeNotifier` implement `Listenable` nên không conflict.
