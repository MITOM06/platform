import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../friends/data/friends_repository.dart';
import '../../friends/domain/friends_provider.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import 'widgets/conversation_avatar.dart';

/// Lists conversations the current user has blocked-archived, each with an
/// "unblock & restore" action. Mirrors [ArchivedChatsScreen] but for the
/// blocked section (moved out of the conversation list into Settings).
class BlockedConversationsScreen extends ConsumerWidget {
  const BlockedConversationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blockedAsync = ref.watch(blockedConversationsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = isDark ? Colors.redAccent : Colors.redAccent.shade400;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.blockedChatsTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: blockedAsync.when(
        loading: () => Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(accent),
          ),
        ),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_outlined,
                    size: 48, color: Colors.redAccent),
                const SizedBox(height: 16),
                Text(
                  context.l10n.listLoadFailed,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () =>
                      ref.invalidate(blockedConversationsProvider),
                  child: Text(context.l10n.actionRetry),
                ),
              ],
            ),
          ),
        ),
        data: (all) {
          // Blocking is a per-user / DM concept (mirrors web /blocked): a group
          // row would be a dead-end (unblockUser is skipped yet restore fires),
          // so only direct conversations are listed here.
          final conversations =
              all.where((c) => c.type == 'direct').toList();
          return conversations.isEmpty
              ? _EmptyBlocked(isDark: isDark, accent: accent)
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: conversations.length,
                  itemBuilder: (context, index) =>
                      _BlockedTile(conv: conversations[index]),
                );
        },
      ),
    );
  }
}

class _EmptyBlocked extends StatelessWidget {
  final bool isDark;
  final Color accent;

  const _EmptyBlocked({required this.isDark, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.block_rounded,
            size: 64,
            color: accent.withValues(alpha: 0.6),
          ),
          const SizedBox(height: 16),
          Text(
            context.l10n.noBlockedChats,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white70 : Colors.black87,
            ),
          ),
        ],
      ),
    );
  }
}

/// A single blocked conversation row with an inline "unblock & restore" action.
class _BlockedTile extends ConsumerWidget {
  final ConversationModel conv;

  const _BlockedTile({required this.conv});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = context.l10n;
    final isGroup = conv.isGroup;

    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId =
        authState is AuthAuthenticated ? authState.user.id : '';
    final others =
        conv.participants.where((p) => p != currentUserId).toList();
    final otherUserId = !isGroup && others.isNotEmpty ? others.first : '';

    final profileData = otherUserId.isNotEmpty
        ? ref.watch(
            userProfileProvider(otherUserId).select((s) => s.valueOrNull),
          )
        : null;
    final displayName = isGroup
        ? (conv.name ?? l10n.conversationDefault)
        : (profileData?.displayName ?? l10n.conversationDefault);
    final tileLetter = displayName.isNotEmpty && displayName != '...'
        ? displayName[0].toUpperCase()
        : '?';
    final avatarUrl = isGroup ? conv.avatarUrl : profileData?.avatarUrl;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color:
            isDark ? AppTheme.darkSurface.withValues(alpha: 0.4) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? AppTheme.darkBorder.withValues(alpha: 0.2)
              : Colors.black.withValues(alpha: 0.05),
          width: 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: ListTile(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          leading: ConversationAvatar(
            avatarUrl: avatarUrl,
            fallbackLetter: tileLetter,
            isGroup: isGroup,
            size: 48,
          ),
          title: Text(
            displayName.isEmpty ? l10n.conversationDefault : displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : Colors.black87,
              fontSize: 15,
            ),
          ),
          trailing: TextButton(
            onPressed: () async {
              if (otherUserId.isNotEmpty) {
                await ref
                    .read(friendsRepositoryProvider)
                    .unblockUser(otherUserId);
                ref.invalidate(relationshipProvider(otherUserId));
              }
              await ref
                  .read(conversationsNotifierProvider.notifier)
                  .unblockAndRestoreConversation(conv.id);
            },
            child: Text(
              l10n.unblockAndRestore,
              style: const TextStyle(color: Colors.redAccent),
            ),
          ),
        ),
      ),
    );
  }
}
