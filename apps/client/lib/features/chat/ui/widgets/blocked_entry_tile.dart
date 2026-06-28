import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../friends/data/friends_repository.dart';
import '../../../friends/domain/friends_provider.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';

/// Expandable/collapsible section showing blocked conversations.
/// Only rendered when there is at least one blocked conversation.
class BlockedConversationsSection extends ConsumerStatefulWidget {
  const BlockedConversationsSection({super.key});

  @override
  ConsumerState<BlockedConversationsSection> createState() =>
      _BlockedConversationsSectionState();
}

class _BlockedConversationsSectionState
    extends ConsumerState<BlockedConversationsSection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final blockedAsync = ref.watch(blockedConversationsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent =
        isDark ? Colors.redAccent : Colors.redAccent.shade200;

    return blockedAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (blocked) {
        if (blocked.isEmpty) return const SizedBox.shrink();
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Section header — tap to expand/collapse
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => setState(() => _expanded = !_expanded),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: accent.withValues(
                              alpha: isDark ? 0.15 : 0.1),
                        ),
                        child: Icon(Icons.block_rounded,
                            size: 20, color: accent),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Text(
                          '${context.l10n.blockedChats} (${blocked.length})',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: isDark
                                ? Colors.white.withValues(alpha: 0.85)
                                : Colors.black87,
                          ),
                        ),
                      ),
                      AnimatedRotation(
                        turns: _expanded ? 0.5 : 0,
                        duration: const Duration(milliseconds: 200),
                        child: Icon(
                          Icons.keyboard_arrow_down_rounded,
                          color:
                              isDark ? Colors.white38 : Colors.black38,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            // Expandable list
            if (_expanded)
              for (final conv in blocked)
                _BlockedConversationTile(conv: conv),
          ],
        );
      },
    );
  }
}

/// A single row in the blocked section, with an "Unblock" action.
class _BlockedConversationTile extends ConsumerWidget {
  final ConversationModel conv;
  const _BlockedConversationTile({required this.conv});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = context.l10n;

    final notifier = ref.read(conversationsNotifierProvider.notifier);

    // Resolve display name the same way ConversationTile does: for DMs use
    // the other participant's profile; for groups fall back to conv.name.
    final currentUserId = ref.watch(authUserId);
    final others =
        conv.participants.where((p) => p != currentUserId).toList();
    final otherUserId =
        !conv.isGroup && others.isNotEmpty ? others.first : '';

    String displayName;
    if (conv.isGroup) {
      displayName = conv.name ?? l10n.conversationDefault;
    } else if (otherUserId.isNotEmpty) {
      final profileData = ref.watch(
        userProfileProvider(otherUserId).select((s) => s.valueOrNull),
      );
      displayName = profileData?.displayName ?? l10n.conversationDefault;
    } else {
      displayName = conv.name ?? l10n.conversationDefault;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        tileColor: isDark
            ? AppTheme.darkSurface.withValues(alpha: 0.4)
            : Colors.white,
        leading: const Icon(Icons.block_rounded, color: Colors.redAccent),
        title: Text(
          displayName,
          style: TextStyle(
            color: isDark
                ? Colors.white.withValues(alpha: 0.75)
                : Colors.black87,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: TextButton(
          onPressed: () async {
            if (otherUserId.isNotEmpty) {
              await ref
                  .read(friendsRepositoryProvider)
                  .unblockUser(otherUserId);
              ref.invalidate(relationshipProvider(otherUserId));
            }
            await notifier.unblockAndRestoreConversation(conv.id);
          },
          child: Text(
            l10n.unblockAndRestore,
            style: const TextStyle(color: Colors.redAccent),
          ),
        ),
      ),
    );
  }
}

/// Minimal provider to read the current user id without the full auth notifier.
final authUserId = Provider.autoDispose<String>((ref) {
  final auth = ref.watch(authNotifierProvider).valueOrNull;
  if (auth is AuthAuthenticated) return auth.user.id;
  return '';
});
