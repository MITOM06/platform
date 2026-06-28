import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/utils/media_url.dart';
import '../../friends/data/friends_repository.dart';
import '../../friends/domain/friends_provider.dart';
import '../data/notification_model.dart';
import '../domain/notifications_provider.dart';

/// Bottom-sheet body listing the user's notifications (avatar + title + time,
/// plus Accept/Decline for FRIEND_REQUEST items). Mirror of web's
/// `NotificationBell` popover content.
class NotificationPanel extends ConsumerWidget {
  const NotificationPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final async = ref.watch(notificationsProvider);
    final unread = ref.watch(unreadNotificationCountProvider);

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 8, bottom: 4),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: isDark ? Colors.white24 : Colors.black26,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 12, 8),
            child: Row(
              children: [
                Text(
                  context.l10n.notificationsTitle,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const Spacer(),
                if (unread > 0)
                  TextButton(
                    onPressed: () =>
                        ref.read(notificationsProvider.notifier).markAllRead(),
                    child: Text(context.l10n.notificationsMarkAllRead),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          Flexible(
            child: async.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 48),
                child: Center(
                  child: Text(
                    friendlyError(e),
                    style: TextStyle(
                        color: isDark ? Colors.white54 : Colors.black54),
                  ),
                ),
              ),
              data: (items) => items.isEmpty
                  ? _EmptyState(isDark: isDark)
                  : ListView.separated(
                      shrinkWrap: true,
                      padding: const EdgeInsets.only(bottom: 8),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) =>
                          _NotificationTile(notification: items[i]),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool isDark;
  const _EmptyState({required this.isDark});

  @override
  Widget build(BuildContext context) {
    final muted = isDark ? Colors.white38 : Colors.black38;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 56),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.notifications_none_rounded, size: 48, color: muted),
          const SizedBox(height: 12),
          Text(
            context.l10n.notificationsEmpty,
            style: TextStyle(color: muted, fontSize: 14),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends ConsumerStatefulWidget {
  final AppNotification notification;
  const _NotificationTile({required this.notification});

  @override
  ConsumerState<_NotificationTile> createState() => _NotificationTileState();
}

class _NotificationTileState extends ConsumerState<_NotificationTile> {
  bool _acting = false;

  Future<void> _handle(Future<void> Function() action) async {
    if (_acting) return;
    setState(() => _acting = true);
    final n = widget.notification;
    try {
      await action();
      await ref.read(notificationsProvider.notifier).markRead(n.id);
      // Keep the friends lists in sync with the action taken here.
      ref.invalidate(friendRequestsProvider);
      ref.invalidate(friendsListProvider);
    } catch (e) {
      showErrorSnackBar(friendlyError(e));
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _accept() {
    final id = widget.notification.relatedEntityId;
    if (id == null) return Future.value();
    return _handle(
        () => ref.read(friendsRepositoryProvider).acceptRequest(id));
  }

  Future<void> _decline() {
    final id = widget.notification.relatedEntityId;
    if (id == null) return Future.value();
    return _handle(
        () => ref.read(friendsRepositoryProvider).removeFriend(id));
  }

  /// Setup nudges (PHONE_SETUP / PASSWORD_SETUP) deep-link to the screen where
  /// the user resolves them. Closes the bottom sheet, marks read, navigates.
  void _onTap() {
    final n = widget.notification;
    String? route;
    if (n.type == 'PHONE_SETUP') {
      route = '/edit-profile';
    } else if (n.type == 'PASSWORD_SETUP') {
      route = '/settings/security';
    }

    if (n.isUnread) {
      ref.read(notificationsProvider.notifier).markRead(n.id);
    }
    if (route != null) {
      Navigator.of(context).pop(); // dismiss the bottom sheet first
      context.push(route);
    }
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.notification;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent =
        isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary;

    return Container(
      color: n.isUnread ? accent.withValues(alpha: 0.06) : null,
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        onTap: (n.isUnread ||
                n.type == 'PHONE_SETUP' ||
                n.type == 'PASSWORD_SETUP')
            ? _onTap
            : null,
        leading: _Avatar(notification: n),
        title: Text(
          n.title,
          style: TextStyle(
            fontSize: 14,
            color: isDark ? Colors.white : Colors.black87,
            fontWeight: n.isUnread ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 2),
            Text(
              _relativeTime(context, n.createdAt),
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.white54 : Colors.black54,
              ),
            ),
            if (n.isFriendRequest && n.relatedEntityId != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: accent,
                      foregroundColor: Colors.white,
                      visualDensity: VisualDensity.compact,
                      padding:
                          const EdgeInsets.symmetric(horizontal: 16),
                    ),
                    onPressed: _acting ? null : _accept,
                    child: Text(context.l10n.notificationAccept),
                  ),
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: _acting ? null : _decline,
                    child: Text(context.l10n.notificationDecline),
                  ),
                ],
              ),
            ],
          ],
        ),
        trailing: n.isUnread
            ? Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: accent,
                  shape: BoxShape.circle,
                ),
              )
            : null,
      ),
    );
  }

  /// Locale-aware timestamp: same-day notifications show the time, older ones
  /// show the date. Uses `package:intl` so formatting follows the user locale
  /// (no hardcoded patterns / strings — see .claude/rules/i18n.md).
  String _relativeTime(BuildContext context, DateTime time) {
    final local = time.toLocal();
    final now = DateTime.now();
    final sameDay = local.year == now.year &&
        local.month == now.month &&
        local.day == now.day;
    final locale = Localizations.localeOf(context).toString();
    return sameDay
        ? DateFormat.jm(locale).format(local)
        : DateFormat.yMMMd(locale).add_jm().format(local);
  }
}

class _Avatar extends StatelessWidget {
  final AppNotification notification;
  const _Avatar({required this.notification});

  @override
  Widget build(BuildContext context) {
    final n = notification;
    final url = n.actorAvatarUrl;
    final hasAvatar = url != null && url.isNotEmpty;
    return CircleAvatar(
      radius: 22,
      backgroundColor: AppTheme.ponCyan.withValues(alpha: 0.15),
      backgroundImage:
          hasAvatar ? NetworkImage(absoluteMediaUrl(url)) : null,
      child: hasAvatar
          ? null
          : Icon(_iconFor(n.type), color: AppTheme.ponCyan, size: 20),
    );
  }

  IconData _iconFor(String type) {
    switch (type) {
      case 'FRIEND_REQUEST':
        return Icons.person_add_alt_1_rounded;
      case 'FRIEND_ACCEPTED':
        return Icons.people_alt_rounded;
      case 'PASSWORD_SETUP':
        return Icons.shield_outlined;
      case 'PHONE_SETUP':
        return Icons.phone_android_outlined;
      default:
        return Icons.info_outline_rounded;
    }
  }
}
