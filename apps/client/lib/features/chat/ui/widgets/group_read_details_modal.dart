import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';

/// Shows a bottom sheet listing all group members who have read [message].
void showGroupReadDetailsModal(BuildContext context, MessageModel message) {
  if (message.readBy.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(context.l10n.noReadsYet)),
    );
    return;
  }
  showModalBottomSheet(
    context: context,
    backgroundColor: AppTheme.darkSurface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => GroupReadDetailsModal(message: message),
  );
}

class GroupReadDetailsModal extends ConsumerWidget {
  final MessageModel message;
  const GroupReadDetailsModal({super.key, required this.message});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    return DraggableScrollableSheet(
      initialChildSize: 0.45,
      minChildSize: 0.3,
      maxChildSize: 0.85,
      expand: false,
      builder: (_, scrollController) => Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4.5,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            l10n.readDetails,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: Colors.white10),
          Expanded(
            child: ListView.builder(
              controller: scrollController,
              itemCount: message.readBy.length,
              itemBuilder: (ctx, i) =>
                  _ReadUserTile(userId: message.readBy[i]),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReadUserTile extends ConsumerWidget {
  final String userId;
  const _ReadUserTile({required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider(userId));
    return profileAsync.when(
      data: (profile) => ListTile(
        leading: ConversationAvatar(
          avatarUrl: profile.avatarUrl,
          fallbackLetter: profile.displayName.isNotEmpty
              ? profile.displayName[0].toUpperCase()
              : '?',
          size: 40,
        ),
        title: Text(
          profile.displayName,
          style: const TextStyle(color: Colors.white, fontSize: 14),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.done_all_rounded,
                size: 16, color: AppTheme.ponCyan),
            const SizedBox(width: 4),
            Text(
              context.l10n.seenStatus,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.55),
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
      loading: () => const ListTile(
        leading: SizedBox(
          width: 40,
          height: 40,
          child: Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor:
                    AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
              ),
            ),
          ),
        ),
        title: Text('...', style: TextStyle(color: Colors.white38)),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}
