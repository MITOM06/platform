import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../chat/data/chat_repository.dart';
import '../../../friends/data/friends_repository.dart';
import '../../../friends/domain/friends_provider.dart';

/// Action row (message / add-friend / block) shown for another user's profile.
/// Extracted from user_profile_dialog.dart (clean-code file limit).
class OtherUserActions extends ConsumerWidget {
  final String userId;
  final String? currentUserId;
  final bool isDark;

  const OtherUserActions({
    super.key,
    required this.userId,
    required this.currentUserId,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rel = ref.watch(relationshipProvider(userId)).valueOrNull;
    final isFriend = rel?.friendStatus == 'accepted';
    // 'outgoing' = request already sent, 'incoming' = request received.
    // In either case the user should NOT see "Add Friend" (would duplicate
    // the request or be the wrong action).
    final pending =
        rel?.friendStatus == 'outgoing' || rel?.friendStatus == 'incoming';
    final iBlocked = rel?.iBlocked ?? false;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        ProfileActionChip(
          icon: Icons.message_outlined,
          label: context.l10n.actionMessage,
          onTap: () async {
            Navigator.of(context).pop();
            final conv = await ref
                .read(chatRepositoryProvider)
                .getOrCreateConversation(userId);
            if (context.mounted) context.go('/chat/${conv.id}');
          },
        ),
        if (!isFriend && !pending)
          ProfileActionChip(
            icon: Icons.person_add_outlined,
            label: context.l10n.actionAddFriend,
            onTap: () async {
              await ref.read(friendsRepositoryProvider).sendRequest(userId);
              ref.invalidate(relationshipProvider(userId));
              // Keep the Friends screen's requests/friends lists in sync.
              ref.invalidate(friendRequestsProvider);
            },
          ),
        ProfileActionChip(
          icon: iBlocked ? Icons.lock_open_rounded : Icons.block_rounded,
          label: context.l10n.actionBlock,
          color: Colors.redAccent,
          onTap: () async {
            final repo = ref.read(friendsRepositoryProvider);
            if (iBlocked) {
              await repo.unblockUser(userId);
            } else {
              await repo.blockUser(userId);
            }
            ref.invalidate(relationshipProvider(userId));
          },
        ),
      ],
    );
  }
}

/// Single circular icon action used in the profile action row.
class ProfileActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;
  final VoidCallback onTap;

  const ProfileActionChip({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppTheme.ponCyan;
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: c.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: c, size: 20),
          ),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 11, color: c)),
        ],
      ),
    );
  }
}
