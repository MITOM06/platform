import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';

class ChatScreenAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final String conversationId;
  final String currentUserId;
  final VoidCallback onSearch;
  final VoidCallback onClearHistory;
  final VoidCallback onChooseAutoDelete;
  final VoidCallback onDeleteConversation;

  const ChatScreenAppBar({
    super.key,
    required this.conversationId,
    required this.currentUserId,
    required this.onSearch,
    required this.onClearHistory,
    required this.onChooseAutoDelete,
    required this.onDeleteConversation,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + 8);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversations =
        ref.watch(conversationsNotifierProvider).valueOrNull ?? [];
    final ConversationModel? conv = conversations
        .where((c) => c.id == conversationId)
        .cast<ConversationModel?>()
        .firstOrNull;

    final isGroup = conv?.isGroup ?? false;
    final others =
        conv?.participants.where((p) => p != currentUserId).toList() ?? [];
    final String? otherUserId =
        (!isGroup && others.isNotEmpty) ? others.first : null;

    final profileAsync = (otherUserId != null)
        ? ref.watch(userProfileProvider(otherUserId))
        : null;
    final statusAsync = (otherUserId != null && !isGroup)
        ? ref.watch(userStatusProvider(otherUserId))
        : null;

    final resolvedName = profileAsync?.valueOrNull?.displayName;
    final displayName = isGroup
        ? (conv?.name ?? context.l10n.conversationDefault)
        : (resolvedName ?? context.l10n.chatDefaultTitle);
    final avatarLetter =
        displayName.isNotEmpty && displayName != context.l10n.chatDefaultTitle
            ? displayName[0].toUpperCase()
            : '?';
    final isOnline = !isGroup && (statusAsync?.valueOrNull?.online ?? false);

    return Container(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: AppTheme.darkBorder.withValues(alpha: 0.3),
            width: 1,
          ),
        ),
      ),
      child: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
        titleSpacing: 0,
        title: Row(
          children: [
            GestureDetector(
              onTap: () {
                if (isGroup) {
                  context.push('/group-info/$conversationId');
                } else if (otherUserId != null && otherUserId.isNotEmpty) {
                  context.push('/user/$otherUserId?conversationId=$conversationId');
                }
              },
              child: ConversationAvatar(
                avatarUrl: isGroup ? conv?.avatarUrl : profileAsync?.valueOrNull?.avatarUrl,
                fallbackLetter: avatarLetter,
                isGroup: isGroup,
                size: 38,
                online: isOnline,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    displayName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  if (isGroup)
                    Text(
                      context.l10n.membersCount(
                          conv?.participants.length ?? 0),
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.white.withValues(alpha: 0.4),
                      ),
                    )
                  else if (statusAsync != null)
                    statusAsync.when(
                      data: (status) => Text(
                        _statusText(context, status),
                        style: TextStyle(
                          fontSize: 11,
                          color: status.online
                              ? AppTheme.onlineGreen.withValues(alpha: 0.8)
                              : Colors.white.withValues(alpha: 0.35),
                          fontWeight: status.online
                              ? FontWeight.w600
                              : FontWeight.normal,
                        ),
                      ),
                      loading: () => Text(
                        '...',
                        style: TextStyle(
                            fontSize: 11,
                            color: Colors.white.withValues(alpha: 0.3)),
                      ),
                      error: (_, __) => const SizedBox.shrink(),
                    ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search_rounded, color: Colors.white, size: 22),
            tooltip: context.l10n.searchMessages,
            onPressed: onSearch,
          ),
          if (!isGroup && otherUserId != null) ...[
            IconButton(
              icon: const Icon(Icons.call_outlined, color: Colors.white, size: 22),
              onPressed: () => context.push('/call', extra: {
                'targetId': otherUserId,
                'targetName': resolvedName ?? 'User',
                'conversationId': conversationId,
                'isCaller': true,
              }),
            ),
            IconButton(
              icon:
                  const Icon(Icons.videocam_outlined, color: Colors.white, size: 24),
              onPressed: () => context.push('/call', extra: {
                'targetId': otherUserId,
                'targetName': resolvedName ?? 'User',
                'conversationId': conversationId,
                'isCaller': true,
              }),
            ),
          ],
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
            color: AppTheme.darkSurface,
            onSelected: (value) {
              switch (value) {
                case 'group':
                  context.push('/group-info/$conversationId');
                case 'clear':
                  onClearHistory();
                case 'auto':
                  onChooseAutoDelete();
                case 'delete':
                  onDeleteConversation();
              }
            },
            itemBuilder: (ctx) => [
              if (isGroup)
                PopupMenuItem(
                  value: 'group',
                  child: Text(ctx.l10n.groupInfo),
                ),
              PopupMenuItem(
                  value: 'clear', child: Text(ctx.l10n.clearHistory)),
              PopupMenuItem(
                  value: 'auto',
                  child: Text(ctx.l10n.disappearingMessages)),
              PopupMenuItem(
                  value: 'delete',
                  child: Text(ctx.l10n.deleteConversation)),
            ],
          ),
        ],
      ),
    );
  }

  String _statusText(BuildContext context, UserStatus status) {
    if (status.online) return context.l10n.statusOnline;
    if (status.lastSeen == null) return context.l10n.statusOffline;
    try {
      final last = status.lastSeen!.toLocal();
      final diff = DateTime.now().difference(last);
      if (diff.inMinutes < 1) return context.l10n.lastSeenJustNow;
      if (diff.inHours < 1) return context.l10n.lastSeenMinutes(diff.inMinutes);
      if (diff.inDays < 1) return context.l10n.lastSeenHours(diff.inHours);
      return context.l10n.lastSeenDays(diff.inDays);
    } catch (_) {
      return context.l10n.statusOffline;
    }
  }
}
