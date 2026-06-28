import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../friends/data/friends_repository.dart';
import '../../../friends/domain/friends_provider.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';

void showConversationTileMenu(
    BuildContext context, WidgetRef ref, ConversationModel conv) {
  final l10n = context.l10n;
  final notifier = ref.read(conversationsNotifierProvider.notifier);

  final currentUserId =
      ref.read(authNotifierProvider).valueOrNull is AuthAuthenticated
          ? (ref.read(authNotifierProvider).valueOrNull as AuthAuthenticated)
              .user
              .id
          : '';
  final others =
      conv.participants.where((p) => p != currentUserId).toList();
  final otherUserId =
      !conv.isGroup && others.isNotEmpty ? others.first : '';

  // conv.isBlocked is the authoritative flag for the blocked-archive state.
  final isConvBlocked = conv.isBlocked;

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
          if (conv.unreadCount > 0)
            ListTile(
              leading: const Icon(Icons.mark_chat_read_outlined,
                  color: Colors.white70),
              title: Text(l10n.markAsRead,
                  style: const TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(sheetCtx);
                notifier.markConversationReadServer(conv.id);
              },
            )
          else
            ListTile(
              leading: const Icon(Icons.mark_chat_unread_outlined,
                  color: Colors.white70),
              title: Text(l10n.markAsUnread,
                  style: const TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(sheetCtx);
                notifier.markConversationUnreadServer(conv.id);
              },
            ),
          // Mute: unmute directly; mute shows a duration picker bottom sheet.
          if (conv.isMuted)
            ListTile(
              leading: const Icon(Icons.volume_up_outlined, color: Colors.white70),
              title: Text(l10n.unmuteNotifications,
                  style: const TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(sheetCtx);
                notifier.toggleMuteConversation(conv.id, false);
              },
            )
          else
            ListTile(
              leading: const Icon(Icons.volume_off_outlined, color: Colors.white70),
              title: Text(l10n.muteNotifications,
                  style: const TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(sheetCtx);
                _showMuteDurationSheet(context, ref, conv.id, notifier);
              },
            ),
          ListTile(
            leading: Icon(
                conv.isGroup
                    ? Icons.info_outline_rounded
                    : Icons.person_outline_rounded,
                color: Colors.white70),
            title: Text(conv.isGroup ? l10n.groupInfo : l10n.viewProfile,
                style: const TextStyle(color: Colors.white)),
            onTap: () {
              Navigator.pop(sheetCtx);
              if (conv.isGroup) {
                context.push('/group-info/${conv.id}');
              } else if (otherUserId.isNotEmpty) {
                context.push('/user/$otherUserId');
              }
            },
          ),
          if (!conv.isGroup && otherUserId.isNotEmpty) ...[
            ListTile(
              leading:
                  const Icon(Icons.phone_outlined, color: Colors.white70),
              title: Text(l10n.voiceCall,
                  style: const TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(sheetCtx);
                final profile =
                    ref.read(userProfileProvider(otherUserId)).valueOrNull;
                final name = profile?.displayName ?? 'User';
                context.push('/call', extra: {
                  'targetId': otherUserId,
                  'targetName': name,
                  'conversationId': conv.id,
                  'isCaller': true,
                  'isVideo': false,
                });
              },
            ),
            ListTile(
              leading:
                  const Icon(Icons.videocam_outlined, color: Colors.white70),
              title: Text(l10n.videoCall,
                  style: const TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(sheetCtx);
                final profile =
                    ref.read(userProfileProvider(otherUserId)).valueOrNull;
                final name = profile?.displayName ?? 'User';
                context.push('/call', extra: {
                  'targetId': otherUserId,
                  'targetName': name,
                  'conversationId': conv.id,
                  'isCaller': true,
                  'isVideo': true,
                });
              },
            ),
            // Block/Unblock — paired with conversation block-archive/restore.
            if (isConvBlocked)
              ListTile(
                leading: const Icon(Icons.lock_open_rounded, color: Colors.white70),
                title: Text(l10n.unblockAndRestore,
                    style: const TextStyle(color: Colors.white70)),
                onTap: () async {
                  Navigator.pop(sheetCtx);
                  final repo = ref.read(friendsRepositoryProvider);
                  await repo.unblockUser(otherUserId);
                  ref.invalidate(relationshipProvider(otherUserId));
                  await notifier.unblockAndRestoreConversation(conv.id);
                },
              )
            else
              ListTile(
                leading: const Icon(Icons.block_rounded, color: Colors.redAccent),
                title: Text(l10n.blockAndHide,
                    style: const TextStyle(color: Colors.redAccent)),
                onTap: () async {
                  Navigator.pop(sheetCtx);
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: Text(l10n.blockUser),
                      content: Text(l10n.blockUserConfirm),
                      actions: [
                        TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: Text(l10n.actionCancel)),
                        FilledButton(
                          style: FilledButton.styleFrom(
                              backgroundColor: Colors.redAccent),
                          onPressed: () => Navigator.pop(ctx, true),
                          child: Text(l10n.actionConfirm),
                        ),
                      ],
                    ),
                  );
                  if (ok == true) {
                    final repo = ref.read(friendsRepositoryProvider);
                    await repo.blockUser(otherUserId);
                    ref.invalidate(relationshipProvider(otherUserId));
                    await notifier.blockAndArchiveConversation(conv.id);
                  }
                },
              ),
          ],
          if (!isConvBlocked)
            ListTile(
              leading:
                  const Icon(Icons.archive_outlined, color: Colors.white70),
              title: Text(l10n.archiveChat,
                  style: const TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(sheetCtx);
                notifier.archiveConversation(conv.id);
              },
            ),
          ListTile(
            leading: const Icon(Icons.delete_outline_rounded,
                color: Colors.redAccent),
            title: Text(l10n.deleteConversation,
                style: const TextStyle(color: Colors.redAccent)),
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

/// Shows a bottom sheet with 5 mute duration options.
void _showMuteDurationSheet(
  BuildContext context,
  WidgetRef ref,
  String conversationId,
  ConversationsNotifier notifier,
) {
  final l10n = context.l10n;
  final options = [
    (label: l10n.mute15min, seconds: 900),
    (label: l10n.mute30min, seconds: 1800),
    (label: l10n.mute1hour, seconds: 3600),
    (label: l10n.mute24hours, seconds: 86400),
    (label: l10n.muteForever, seconds: -1),
  ];

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
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Text(
              l10n.muteNotifications,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ),
          for (final option in options)
            ListTile(
              title: Text(option.label,
                  style: const TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(sheetCtx);
                notifier.toggleMuteConversation(
                  conversationId,
                  true,
                  durationSeconds: option.seconds,
                );
              },
            ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
}
