import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../friends/domain/friends_provider.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';

/// Messenger-style horizontal row of friends who are currently online.
/// Hidden entirely when no friends are online. Updated live via STOMP presence.
class ActiveFriendsRow extends ConsumerWidget {
  const ActiveFriendsRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Never show the current user in the "active now" row — presence events on
    // /topic/presence carry every user (including self), and a self entry would
    // render a green dot on our own avatar.
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final ownId = authState is AuthAuthenticated ? authState.user.id : null;
    final online = (ref.watch(onlineFriendsNotifierProvider).valueOrNull ?? [])
        .where((f) => f.id != ownId)
        .toList();
    if (online.isEmpty) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.only(top: 8, bottom: 4),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isDark
                ? AppTheme.darkBorder.withValues(alpha: 0.2)
                : Colors.black.withValues(alpha: 0.05),
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              context.l10n.activeFriends,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white54 : Colors.black54,
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            // Avatar (52) + name + access-time line; bumped so the extra line
            // never triggers a RenderFlex overflow on small screens.
            height: 104,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: online.length,
              itemBuilder: (context, index) =>
                  _ActiveFriendTile(friend: online[index]),
            ),
          ),
        ],
      ),
    );
  }
}

/// A single avatar in the active row: avatar + name + the friend's last-access
/// time, watched live via [userStatusProvider] (Messenger story-bar style).
class _ActiveFriendTile extends ConsumerWidget {
  final UserModel friend;

  const _ActiveFriendTile({required this.friend});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final letter =
        friend.displayName.isNotEmpty ? friend.displayName[0].toUpperCase() : '?';
    final status = ref.watch(userStatusProvider(friend.id)).valueOrNull;
    final accessLabel = _accessLabel(context, status);

    return GestureDetector(
      onTap: () => context.push('/user/${friend.id}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: SizedBox(
          width: 64,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ConversationAvatar(
                avatarUrl: friend.avatarUrl,
                fallbackLetter: letter,
                size: 52,
                // The active row only lists online friends; if a presence event
                // hasn't refreshed the status yet, fall back to online.
                online: status?.online ?? true,
              ),
              const SizedBox(height: 4),
              Text(
                friend.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  color: isDark ? Colors.white70 : Colors.black87,
                ),
              ),
              Text(
                accessLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  color: (status?.online ?? true)
                      ? AppTheme.onlineGreen.withValues(alpha: 0.9)
                      : (isDark ? Colors.white38 : Colors.black45),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// "active now" when online, otherwise a compact relative last-seen label.
  String _accessLabel(BuildContext context, UserStatus? status) {
    if (status == null || status.online) {
      return context.l10n.statusOnline;
    }
    final lastSeen = status.lastSeen;
    if (lastSeen == null) return context.l10n.statusOffline;
    final diff = DateTime.now().difference(lastSeen.toLocal());
    if (diff.inMinutes < 1) return context.l10n.lastSeenJustNow;
    if (diff.inHours < 1) return context.l10n.lastSeenMinutes(diff.inMinutes);
    if (diff.inDays < 1) return context.l10n.lastSeenHours(diff.inHours);
    return context.l10n.lastSeenDays(diff.inDays);
  }
}
