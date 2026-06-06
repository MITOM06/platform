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
          ListTile(
            leading: Icon(
                conv.isMuted
                    ? Icons.volume_up_outlined
                    : Icons.volume_off_outlined,
                color: Colors.white70),
            title: Text(
                conv.isMuted
                    ? l10n.unmuteNotifications
                    : l10n.muteNotifications,
                style: const TextStyle(color: Colors.white)),
            onTap: () {
              Navigator.pop(sheetCtx);
              notifier.toggleMuteConversation(conv.id, !conv.isMuted);
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
                });
              },
            ),
            ListTile(
              leading: Icon(
                  iBlocked
                      ? Icons.lock_open_rounded
                      : Icons.block_rounded,
                  color: Colors.redAccent),
              title: Text(iBlocked ? l10n.unblockUser : l10n.blockUser,
                  style: const TextStyle(color: Colors.redAccent)),
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
                    await repo.blockUser(otherUserId);
                    ref.invalidate(relationshipProvider(otherUserId));
                  }
                }
              },
            ),
          ],
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
