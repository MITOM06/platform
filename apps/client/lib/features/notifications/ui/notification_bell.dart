import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../domain/notifications_provider.dart';
import 'notification_panel.dart';

/// App-bar bell with an unread-count badge. Tapping opens the notification
/// panel as a modal bottom sheet. Mirror of web's `NotificationBell`.
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadNotificationCountProvider);

    final icon = IconButton(
      icon: const Icon(Icons.notifications_outlined),
      tooltip: context.l10n.notificationsTitle,
      onPressed: () => _open(context, ref),
    );

    if (unread == 0) return icon;

    return Badge(
      label: Text(unread > 9 ? '9+' : '$unread'),
      offset: const Offset(-6, 6),
      child: icon,
    );
  }

  void _open(BuildContext context, WidgetRef ref) {
    // Refresh on open so the list is current, then show the panel.
    ref.read(notificationsProvider.notifier).refresh();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: false,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.8,
      ),
      builder: (_) => const NotificationPanel(),
    );
  }
}
