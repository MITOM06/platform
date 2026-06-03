import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import 'widgets/conversation_avatar.dart';

/// Lists conversations the user has archived (`isArchived == true`), with the
/// ability to restore each one back into the main list. (Task 71)
class ArchivedChatsScreen extends ConsumerWidget {
  const ArchivedChatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final archivedAsync = ref.watch(archivedConversationsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent =
        isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.archivedChats),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: archivedAsync.when(
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
                      ref.invalidate(archivedConversationsProvider),
                  child: Text(context.l10n.actionRetry),
                ),
              ],
            ),
          ),
        ),
        data: (conversations) => conversations.isEmpty
            ? _EmptyArchived(isDark: isDark, accent: accent)
            : ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: conversations.length,
                itemBuilder: (context, index) =>
                    _ArchivedTile(conv: conversations[index]),
              ),
      ),
    );
  }
}

class _EmptyArchived extends StatelessWidget {
  final bool isDark;
  final Color accent;

  const _EmptyArchived({required this.isDark, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.archive_outlined,
            size: 64,
            color: accent.withValues(alpha: 0.6),
          ),
          const SizedBox(height: 16),
          Text(
            context.l10n.emptyArchivedChats,
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

/// A single archived conversation row with an inline "unarchive" action.
class _ArchivedTile extends ConsumerWidget {
  final ConversationModel conv;

  const _ArchivedTile({required this.conv});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isGroup = conv.isGroup;

    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId =
        authState is AuthAuthenticated ? authState.user.id : '';
    final others =
        conv.participants.where((p) => p != currentUserId).toList();
    final otherUserId = !isGroup && others.isNotEmpty ? others.first : '';

    final profileAsync = otherUserId.isNotEmpty
        ? ref.watch(userProfileProvider(otherUserId))
        : null;
    final displayName = isGroup
        ? (conv.name ?? context.l10n.conversationDefault)
        : (profileAsync?.valueOrNull?.displayName ?? '...');
    final tileLetter = displayName.isNotEmpty && displayName != '...'
        ? displayName[0].toUpperCase()
        : '?';
    final avatarUrl =
        isGroup ? conv.avatarUrl : profileAsync?.valueOrNull?.avatarUrl;

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
            displayName.isEmpty ? context.l10n.conversationDefault : displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : Colors.black87,
              fontSize: 15,
            ),
          ),
          subtitle: conv.lastMessage != null
              ? Text(
                  conv.lastMessage!.content.contains('/api/uploads/')
                      ? context.l10n.attachmentLabel
                      : conv.lastMessage!.content,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: isDark ? Colors.white54 : Colors.black54,
                    fontSize: 13,
                  ),
                )
              : null,
          trailing: IconButton(
            icon: const Icon(Icons.unarchive_outlined),
            tooltip: context.l10n.unarchiveChat,
            color: isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary,
            onPressed: () => ref
                .read(conversationsNotifierProvider.notifier)
                .unarchiveConversation(conv.id),
          ),
          onTap: () => context.push('/chat/${conv.id}'),
        ),
      ),
    );
  }
}
