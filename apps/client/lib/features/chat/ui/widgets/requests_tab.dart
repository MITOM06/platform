import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_request_tile.dart';

/// Third tab of the conversation list — incoming requests: pending DMs the
/// current user did not initiate, and group invites where the user is still in
/// [pendingMembers].
class RequestsTab extends ConsumerWidget {
  final AsyncValue<List<ConversationModel>> convsAsync;
  final String currentUserId;

  const RequestsTab({
    super.key,
    required this.convsAsync,
    required this.currentUserId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent =
        isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary;

    return convsAsync.when(
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
                    ref.read(conversationsNotifierProvider.notifier).refresh(),
                child: Text(context.l10n.actionRetry),
              ),
            ],
          ),
        ),
      ),
      data: (all) {
        final requests = all.where((c) {
          final isPendingDm = c.type == 'direct' &&
              c.status == 'pending' &&
              c.createdBy != currentUserId;
          final isPendingGroup = c.pendingMembers.contains(currentUserId);
          return isPendingDm || isPendingGroup;
        }).toList();

        return RefreshIndicator(
          color: accent,
          backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
          onRefresh: () =>
              ref.read(conversationsNotifierProvider.notifier).refresh(),
          child: requests.isEmpty
              ? _EmptyRequests(isDark: isDark, accent: accent)
              : ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: requests.length,
                  itemBuilder: (context, index) => ConversationRequestTile(
                    conv: requests[index],
                    currentUserId: currentUserId,
                  ),
                ),
        );
      },
    );
  }
}

class _EmptyRequests extends StatelessWidget {
  final bool isDark;
  final Color accent;

  const _EmptyRequests({required this.isDark, required this.accent});

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
                Icons.person_add_outlined,
                size: 64,
                color: accent.withValues(alpha: 0.6),
              ),
              const SizedBox(height: 16),
              Text(
                context.l10n.noRequests,
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
