import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/notification_model.dart';
import '../data/notification_repository.dart';

/// Holds the current user's notifications. Auto-fetches on first read and
/// exposes a [refresh] for pull-to-refresh / re-open. Mirror of web's
/// `useNotifications` hook (TanStack Query). Polling can be added later.
class NotificationsNotifier extends AsyncNotifier<List<AppNotification>> {
  @override
  Future<List<AppNotification>> build() {
    return ref.read(notificationRepositoryProvider).listNotifications();
  }

  /// Re-fetch from the server (e.g. when the panel is opened).
  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(notificationRepositoryProvider).listNotifications(),
    );
  }

  /// Optimistically mark a single notification as read.
  Future<void> markRead(String id) async {
    final current = state.valueOrNull ?? const <AppNotification>[];
    state = AsyncData([
      for (final n in current)
        n.id == id ? n.copyWith(readAt: DateTime.now()) : n,
    ]);
    try {
      await ref.read(notificationRepositoryProvider).markRead(id);
    } catch (_) {
      // Best-effort — keep the optimistic state; a later refresh reconciles.
    }
  }

  /// Optimistically mark all notifications as read.
  Future<void> markAllRead() async {
    final current = state.valueOrNull ?? const <AppNotification>[];
    final now = DateTime.now();
    state = AsyncData([
      for (final n in current) n.isUnread ? n.copyWith(readAt: now) : n,
    ]);
    try {
      await ref.read(notificationRepositoryProvider).markAllRead();
    } catch (_) {
      // Best-effort.
    }
  }
}

final notificationsProvider =
    AsyncNotifierProvider<NotificationsNotifier, List<AppNotification>>(
  NotificationsNotifier.new,
);

/// Unread count derived from [notificationsProvider]. 0 while loading/error.
final unreadNotificationCountProvider = Provider<int>((ref) {
  final async = ref.watch(notificationsProvider);
  final items = async.valueOrNull ?? const <AppNotification>[];
  return items.where((n) => n.isUnread).length;
});
