import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../friends/data/friends_repository.dart';
import '../../../friends/domain/friends_provider.dart';

/// Message + friend + block buttons, driven by the live relationship state.
/// Extracted from user_profile_screen.dart (clean-code file limit).
class RelationshipActions extends ConsumerWidget {
  final String userId;
  final bool busy;
  final VoidCallback onMessage;
  final Future<void> Function(RelationshipState) onFriendAction;
  final Future<void> Function(RelationshipState) onBlockAction;

  const RelationshipActions({
    super.key,
    required this.userId,
    required this.busy,
    required this.onMessage,
    required this.onFriendAction,
    required this.onBlockAction,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final relAsync = ref.watch(relationshipProvider(userId));
    final rel = relAsync.valueOrNull ??
        const RelationshipState(
            friendStatus: 'none', iBlocked: false, blockedMe: false);

    final String friendLabel;
    switch (rel.friendStatus) {
      case 'accepted':
        friendLabel = context.l10n.unfriend;
      case 'outgoing':
        friendLabel = context.l10n.friendRequestPending;
      case 'incoming':
        friendLabel = context.l10n.acceptFriend;
      default:
        friendLabel = context.l10n.addFriend;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: PonButton(
                  onPressed: busy ? null : onMessage,
                  child: Text(context.l10n.messageAction),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: PonButton(
                  gradientColors: const [AppTheme.ponPeach, AppTheme.ponPink],
                  glowColor: AppTheme.ponPink,
                  onPressed: busy ? null : () => onFriendAction(rel),
                  child: Text(friendLabel),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: TextButton.icon(
              onPressed: busy ? null : () => onBlockAction(rel),
              icon: Icon(
                rel.iBlocked ? Icons.lock_open_rounded : Icons.block_rounded,
                color: Colors.redAccent,
                size: 18,
              ),
              label: Text(
                rel.iBlocked ? context.l10n.unblockUser : context.l10n.blockUser,
                style: const TextStyle(color: Colors.redAccent),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
