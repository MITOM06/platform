import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../data/notification_model.dart';
import '../data/notification_repository.dart';

/// Holds the current user's notifications. Mirror of web's `useNotifications`
/// (TanStack Query, refetch every 30 s + on focus): fetched on first read,
/// refreshed silently every [pollInterval] while something listens, and on
/// app resume / panel open. The bell no longer goes stale until a restart.
class NotificationsNotifier extends AsyncNotifier<List<AppNotification>> {
  static const pollInterval = Duration(seconds: 30);
  Timer? _poll;

  bool get _signedIn =>
      ref.read(authNotifierProvider).valueOrNull is AuthAuthenticated;

  @override
  Future<List<AppNotification>> build() async {
    _poll?.cancel();
    ref.onDispose(() => _poll?.cancel());
    // The provider is process-wide: never poll (or 401) while signed out.
    if (!_signedIn) return const [];
    _poll = Timer.periodic(pollInterval, (_) {
      if (_signedIn) refreshSilently();
    });
    return ref.read(notificationRepositoryProvider).listNotifications();
  }

  /// Re-fetch from the server (e.g. when the panel is opened). Keeps the
  /// current list on screen while loading.
  Future<void> refresh() => refreshSilently();

  /// Re-fetch without flashing a spinner; a failed poll keeps the last list
  /// (the panel still shows its error state on the very first load).
  Future<void> refreshSilently() async {
    if (!_signedIn) return;
    final result = await AsyncValue.guard(
      () => ref.read(notificationRepositoryProvider).listNotifications(),
    );
    if (result.hasValue || !state.hasValue) state = result;
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
      // Best-effort — keep the optimistic state; the next poll reconciles.
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
      // Best-effort — the next poll reconciles.
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
