import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import 'conversation_search_bar.dart';
import 'conversation_tile.dart';

/// Second tab of the conversation list — archived conversations. Each
/// [ConversationTile] keeps its long-press context menu (which offers
/// unarchive), so no extra action UI is needed here. The shared search bar
/// filters this list too (mirrors the Chats tab).
class ArchivedTab extends ConsumerWidget {
  final String currentUserId;

  const ArchivedTab({super.key, required this.currentUserId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final archivedAsync = ref.watch(archivedConversationsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent =
        isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary;

    return archivedAsync.when(
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
                onPressed: () => ref.invalidate(archivedConversationsProvider),
                child: Text(context.l10n.actionRetry),
              ),
            ],
          ),
        ),
      ),
      data: (allArchived) {
        // Scope keystroke rebuilds: only this Consumer (the filtered list)
        // re-runs when the search query changes.
        return Consumer(
          builder: (context, ref, _) {
            final search = ref.watch(conversationSearchQueryProvider);
            final conversations = filterConversationsBySearch(
              ref,
              allArchived,
              currentUserId,
              search,
            );
            return RefreshIndicator(
              color: accent,
              backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
              onRefresh: () async =>
                  ref.invalidate(archivedConversationsProvider),
              child: conversations.isEmpty
                  ? _EmptyArchived(isDark: isDark, accent: accent)
                  : ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: conversations.length,
                      itemBuilder: (context, index) =>
                          ConversationTile(conv: conversations[index]),
                    ),
            );
          },
        );
      },
    );
  }
}

class _EmptyArchived extends StatelessWidget {
  final bool isDark;
  final Color accent;

  const _EmptyArchived({required this.isDark, required this.accent});

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.2),
        Center(
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
        ),
      ],
    );
  }
}
