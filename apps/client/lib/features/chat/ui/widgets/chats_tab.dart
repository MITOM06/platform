import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_search_bar.dart';
import 'conversation_tile.dart';

/// First tab of the conversation list — active (non-archived, non-blocked,
/// accepted) conversations. Incoming requests (pending DMs not created by the
/// current user, or groups the user hasn't accepted) are excluded; they live
/// in the Requests tab instead.
class ChatsTab extends ConsumerWidget {
  final AsyncValue<List<ConversationModel>> convsAsync;
  final String currentUserId;

  const ChatsTab({
    super.key,
    required this.convsAsync,
    required this.currentUserId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return convsAsync.when(
      loading: () => Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(
            isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary,
          ),
        ),
      ),
      error: (e, _) => _ChatsError(error: e, isDark: isDark),
      data: (allConversations) {
        // Scope keystroke rebuilds: only this Consumer (the filtered list)
        // re-runs when the search query changes.
        return Consumer(
          builder: (context, ref, _) {
            final search = ref.watch(conversationSearchQueryProvider);
            final chats = allConversations.where((c) {
              if (c.isArchived || c.isBlocked) return false;
              if (c.status == 'pending' && c.createdBy != currentUserId) {
                return false;
              }
              if (c.pendingMembers.contains(currentUserId)) return false;
              return true;
            }).toList();
            final conversations = filterConversationsBySearch(
              ref,
              chats,
              currentUserId,
              search,
            );
            return RefreshIndicator(
              color: isDark
                  ? AppTheme.ponCyan
                  : Theme.of(context).colorScheme.primary,
              backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
              onRefresh: () =>
                  ref.read(conversationsNotifierProvider.notifier).refresh(),
              child: conversations.isEmpty
                  ? _EmptyChats(isDark: isDark, hasQuery: search.isNotEmpty)
                  : ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
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

class _EmptyChats extends StatelessWidget {
  final bool isDark;
  final bool hasQuery;

  const _EmptyChats({required this.isDark, required this.hasQuery});

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
                Icons.chat_bubble_outline,
                size: 64,
                color: isDark
                    ? AppTheme.ponPeach
                    : Theme.of(context)
                        .colorScheme
                        .primary
                        .withValues(alpha: 0.6),
              ),
              const SizedBox(height: 16),
              Text(
                hasQuery
                    ? context.l10n.noConversationsFound
                    : context.l10n.emptyConversations,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white70 : Colors.black87,
                ),
              ),
              if (!hasQuery) ...[
                const SizedBox(height: 8),
                Text(
                  context.l10n.emptyTapPlus,
                  style: TextStyle(
                    color: isDark ? Colors.white38 : Colors.black38,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _ChatsError extends ConsumerWidget {
  final Object error;
  final bool isDark;

  const _ChatsError({required this.error, required this.isDark});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final e = error.toString();
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: PonCard(
          glowColor: Colors.redAccent,
          glowStrength: isDark ? 4 : 0,
          child: Padding(
            padding: const EdgeInsets.all(24.0),
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
                    fontSize: 16,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  e.contains('connect') || e.contains('network')
                      ? context.l10n.listCheckNetwork
                      : context.l10n.listGenericError,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.5)
                        : Colors.black54,
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: 140,
                  child: PonButton(
                    onPressed: () => ref
                        .read(conversationsNotifierProvider.notifier)
                        .refresh(),
                    gradientColors: isDark
                        ? const [AppTheme.ponCyan, AppTheme.ponCyan]
                        : [
                            Theme.of(context).colorScheme.primary,
                            Theme.of(context).colorScheme.primaryContainer,
                          ],
                    glowColor: isDark
                        ? AppTheme.ponCyan
                        : Theme.of(context).colorScheme.primary,
                    child: Text(context.l10n.actionRetry),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
