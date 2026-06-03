import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../friends/data/friends_repository.dart';
import '../../../friends/domain/friends_provider.dart';
import '../../../home/domain/home_providers.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';

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

    // On the web/tablet master-detail layout the tile drives the right pane
    // instead of pushing a route; it also paints a selected state.
    final isWeb = MediaQuery.of(context).size.width >= kWebBreakpoint;
    final isSelected =
        isWeb && ref.watch(selectedConversationIdProvider) == conv.id;

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
    final nicknames = ref.watch(nicknamesProvider(conv.id));
    final dmNickname = (!isGroup && otherUserId.isNotEmpty)
        ? nicknames[otherUserId]
        : null;
    final displayName = isGroup
        ? (conv.name ?? context.l10n.conversationDefault)
        : ((dmNickname != null && dmNickname.isNotEmpty)
            ? dmNickname
            : (profileAsync?.valueOrNull?.displayName ?? '...'));
    final tileLetter = displayName.isNotEmpty && displayName != '...'
        ? displayName[0].toUpperCase()
        : '?';
    final avatarUrl =
        isGroup ? conv.avatarUrl : profileAsync?.valueOrNull?.avatarUrl;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: isSelected
            ? (isDark
                ? AppTheme.ponCyan.withValues(alpha: 0.12)
                : Theme.of(context).colorScheme.primary.withValues(alpha: 0.08))
            : (isDark
                ? AppTheme.darkSurface.withValues(alpha: 0.4)
                : Colors.white),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected
              ? (isDark
                      ? AppTheme.ponCyan
                      : Theme.of(context).colorScheme.primary)
                  .withValues(alpha: 0.6)
              : conv.unreadCount > 0
                  ? (isDark
                          ? AppTheme.ponCyan
                          : Theme.of(context).colorScheme.primary)
                      .withValues(alpha: 0.25)
                  : (isDark
                      ? AppTheme.darkBorder.withValues(alpha: 0.2)
                      : Colors.black.withValues(alpha: 0.05)),
          width: isSelected ? 1.5 : 1,
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
          title: Row(
            children: [
              Expanded(
                child: Text(
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
              ),
              if (conv.isMuted) ...[
                const SizedBox(width: 6),
                Icon(
                  Icons.volume_off_rounded,
                  size: 15,
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.4)
                      : Colors.black.withValues(alpha: 0.4),
                ),
              ],
            ],
          ),
          subtitle: conv.lastMessage != null
              ? Padding(
                  padding: const EdgeInsets.only(top: 4.0),
                  child: Text(
                    _subtitleText(context, conv.lastMessage!.content),
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
          onTap: () {
            if (isWeb) {
              ref.read(selectedConversationIdProvider.notifier).state = conv.id;
            } else {
              context.push('/chat/${conv.id}');
            }
          },
          onLongPress: () => _showTileMenu(context, ref),
        ),
      ),
    );
  }

  String _subtitleText(BuildContext context, String content) {
    if (content.contains('/api/uploads/')) return context.l10n.attachmentLabel;
    if (content.startsWith('system.nickname.changed:')) {
      return context.l10n.localeName == 'vi'
          ? 'Biệt danh đã được thay đổi'
          : 'Nickname was changed';
    }
    if (content.startsWith('system.theme.changed:')) {
      return context.l10n.localeName == 'vi'
          ? 'Chủ đề đoạn chat đã thay đổi'
          : 'Chat theme changed';
    }
    if (content.startsWith('system.quick_reaction.changed:')) {
      return context.l10n.localeName == 'vi'
          ? 'Biểu tượng cảm xúc nhanh đã thay đổi'
          : 'Quick reaction changed';
    }
    if (content.startsWith('system.')) return '📢 ${content.split(':').first.replaceAll('system.', '').replaceAll('.', ' ')}';
    return content;
  }

  void _showTileMenu(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final notifier = ref.read(conversationsNotifierProvider.notifier);
    
    final currentUserId = ref.read(authNotifierProvider).valueOrNull is AuthAuthenticated
        ? (ref.read(authNotifierProvider).valueOrNull as AuthAuthenticated).user.id
        : '';
    final others = conv.participants.where((p) => p != currentUserId).toList();
    final otherUserId = !conv.isGroup && others.isNotEmpty ? others.first : '';
    
    final rel = otherUserId.isNotEmpty
        ? ref.read(relationshipProvider(otherUserId)).valueOrNull
        : null;
    final iBlocked = rel?.iBlocked ?? false;

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
            // Mark as Read / Unread
            if (conv.unreadCount > 0)
              ListTile(
                leading: const Icon(Icons.mark_chat_read_outlined, color: Colors.white70),
                title: Text(l10n.markAsRead, style: const TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(sheetCtx);
                  notifier.markConversationReadServer(conv.id);
                },
              )
            else
              ListTile(
                leading: const Icon(Icons.mark_chat_unread_outlined, color: Colors.white70),
                title: Text(l10n.markAsUnread, style: const TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(sheetCtx);
                  notifier.markConversationUnreadServer(conv.id);
                },
              ),
            // Mute / Unmute notifications
            ListTile(
              leading: Icon(conv.isMuted ? Icons.volume_up_outlined : Icons.volume_off_outlined, color: Colors.white70),
              title: Text(conv.isMuted ? l10n.unmuteNotifications : l10n.muteNotifications, style: const TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(sheetCtx);
                notifier.toggleMuteConversation(conv.id, !conv.isMuted);
              },
            ),
            // View Profile
            ListTile(
              leading: Icon(conv.isGroup ? Icons.info_outline_rounded : Icons.person_outline_rounded, color: Colors.white70),
              title: Text(conv.isGroup ? l10n.groupInfo : l10n.viewProfile, style: const TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(sheetCtx);
                if (conv.isGroup) {
                  context.push('/group-info/${conv.id}');
                } else if (otherUserId.isNotEmpty) {
                  context.push('/user/$otherUserId');
                }
              },
            ),
            // Voice Call & Video Call (Direct chats only)
            if (!conv.isGroup && otherUserId.isNotEmpty) ...[
              ListTile(
                leading: const Icon(Icons.phone_outlined, color: Colors.white70),
                title: Text(l10n.voiceCall, style: const TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(sheetCtx);
                  final profile = ref.read(userProfileProvider(otherUserId)).valueOrNull;
                  final name = profile?.displayName ?? 'User';
                  context.push('/call', extra: {
                    'targetId': otherUserId,
                    'targetName': name,
                    'conversationId': conv.id,
                    'isCaller': true,
                  });
                },
              ),
              ListTile(
                leading: const Icon(Icons.videocam_outlined, color: Colors.white70),
                title: Text(l10n.videoCall, style: const TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(sheetCtx);
                  final profile = ref.read(userProfileProvider(otherUserId)).valueOrNull;
                  final name = profile?.displayName ?? 'User';
                  context.push('/call', extra: {
                    'targetId': otherUserId,
                    'targetName': name,
                    'conversationId': conv.id,
                    'isCaller': true,
                  });
                },
              ),
              // Block / Unblock user
              ListTile(
                leading: Icon(iBlocked ? Icons.lock_open_rounded : Icons.block_rounded, color: Colors.redAccent),
                title: Text(iBlocked ? l10n.unblockUser : l10n.blockUser, style: const TextStyle(color: Colors.redAccent)),
                onTap: () async {
                  Navigator.pop(sheetCtx);
                  final repo = ref.read(friendsRepositoryProvider);
                  if (iBlocked) {
                    await repo.unblockUser(otherUserId);
                    ref.invalidate(relationshipProvider(otherUserId));
                  } else {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: Text(l10n.blockUser),
                        content: Text(l10n.blockUserConfirm),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l10n.actionCancel)),
                          FilledButton(
                            style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
                            onPressed: () => Navigator.pop(ctx, true),
                            child: Text(l10n.actionConfirm),
                          ),
                        ],
                      ),
                    );
                    if (ok == true) {
                      await repo.blockUser(otherUserId);
                      ref.invalidate(relationshipProvider(otherUserId));
                    }
                  }
                },
              ),
            ],
            // Archive chat
            ListTile(
              leading: const Icon(Icons.archive_outlined, color: Colors.white70),
              title: Text(l10n.archiveChat, style: const TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(sheetCtx);
                notifier.archiveConversation(conv.id);
              },
            ),
            // Delete chat
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
              title: Text(l10n.deleteConversation, style: const TextStyle(color: Colors.redAccent)),
              onTap: () {
                Navigator.pop(sheetCtx);
                notifier.deleteConversation(conv.id);
              },
            ),
          ],
        ),
      ),
    );
  }
}
