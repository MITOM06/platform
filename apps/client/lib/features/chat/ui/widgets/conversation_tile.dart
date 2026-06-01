import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: Colors.redAccent.withValues(alpha: 0.2),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              const Icon(Icons.wifi_off, size: 16, color: Colors.redAccent),
              const SizedBox(width: 8),
              Text(
                context.l10n.offlineBanner,
                style: TextStyle(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.9)
                      : Colors.redAccent.shade700,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ConversationTile extends ConsumerWidget {
  final ConversationModel conv;

  const ConversationTile({super.key, required this.conv});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId =
        authState is AuthAuthenticated ? authState.user.id : '';
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isGroup = conv.isGroup;

    final others =
        conv.participants.where((p) => p != currentUserId).toList();
    final otherUserId = !isGroup && others.isNotEmpty ? others.first : '';

    final statusAsync = otherUserId.isNotEmpty
        ? ref.watch(userStatusProvider(otherUserId)).valueOrNull
        : null;
    final isOnline = !isGroup && (statusAsync?.online ?? false);

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
        color: isDark ? AppTheme.darkSurface.withValues(alpha: 0.4) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: conv.unreadCount > 0
              ? (isDark
                      ? AppTheme.ponCyan
                      : Theme.of(context).colorScheme.primary)
                  .withValues(alpha: 0.25)
              : (isDark
                  ? AppTheme.darkBorder.withValues(alpha: 0.2)
                  : Colors.black.withValues(alpha: 0.05)),
          width: 1,
        ),
        boxShadow: !isDark
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                )
              ]
            : null,
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
            online: isOnline,
            gradientColors: conv.unreadCount > 0
                ? [
                    isDark
                        ? AppTheme.ponCyan
                        : Theme.of(context).colorScheme.primary,
                    isDark
                        ? AppTheme.ponPink
                        : Theme.of(context).colorScheme.secondary,
                  ]
                : [
                    isDark
                        ? AppTheme.ponPeach.withValues(alpha: 0.6)
                        : Colors.grey.shade400,
                    isDark ? AppTheme.darkBorder : Colors.grey.shade300,
                  ],
          ),
          title: Text(
            displayName.isEmpty ? context.l10n.conversationDefault : displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontWeight:
                  conv.unreadCount > 0 ? FontWeight.bold : FontWeight.w600,
              color: conv.unreadCount > 0
                  ? (isDark ? Colors.white : Colors.black)
                  : (isDark
                      ? Colors.white.withValues(alpha: 0.85)
                      : Colors.black87),
              fontSize: 15,
            ),
          ),
          subtitle: conv.lastMessage != null
              ? Padding(
                  padding: const EdgeInsets.only(top: 4.0),
                  child: Text(
                    conv.lastMessage!.content.contains('/api/uploads/')
                        ? context.l10n.attachmentLabel
                        : conv.lastMessage!.content,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: conv.unreadCount > 0
                          ? (isDark
                              ? Colors.white.withValues(alpha: 0.8)
                              : Colors.black87)
                          : (isDark
                              ? Colors.white.withValues(alpha: 0.45)
                              : Colors.black54),
                      fontSize: 13,
                    ),
                  ),
                )
              : null,
          trailing: conv.unreadCount > 0
              ? Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppTheme.ponPink
                        : Theme.of(context).colorScheme.secondary,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: isDark
                        ? [
                            BoxShadow(
                              color: AppTheme.ponPink.withValues(alpha: 0.4),
                              blurRadius: 8,
                            )
                          ]
                        : null,
                  ),
                  child: Text(
                    '${conv.unreadCount}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                )
              : null,
          onTap: () => context.push('/chat/${conv.id}'),
          onLongPress: () => _showTileMenu(context, ref),
        ),
      ),
    );
  }

  void _showTileMenu(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded,
                  color: Colors.redAccent),
              title: Text(sheetCtx.l10n.deleteConversation,
                  style: const TextStyle(color: Colors.redAccent)),
              onTap: () {
                Navigator.pop(sheetCtx);
                ref
                    .read(conversationsNotifierProvider.notifier)
                    .deleteConversation(conv.id);
              },
            ),
          ],
        ),
      ),
    );
  }
}
