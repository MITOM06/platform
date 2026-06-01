import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../friends/domain/friends_provider.dart';
import 'conversation_avatar.dart';

/// Messenger-style horizontal row of friends who are currently online.
/// Hidden entirely when no friends are online. Updated live via STOMP presence.
class ActiveFriendsRow extends ConsumerWidget {
  const ActiveFriendsRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(onlineFriendsNotifierProvider).valueOrNull ?? [];
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
            height: 84,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: online.length,
              itemBuilder: (context, index) {
                final friend = online[index];
                final letter = friend.displayName.isNotEmpty
                    ? friend.displayName[0].toUpperCase()
                    : '?';
                return GestureDetector(
                  onTap: () => context.push('/user/${friend.id}'),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: SizedBox(
                      width: 60,
                      child: Column(
                        children: [
                          ConversationAvatar(
                            avatarUrl: friend.avatarUrl,
                            fallbackLetter: letter,
                            size: 52,
                            online: true,
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
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
