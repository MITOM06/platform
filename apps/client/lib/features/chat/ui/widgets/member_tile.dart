import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';

enum _MemberAction { promote, demote, remove }

/// A single member row in the group-info member list. Resolves the member's
/// display name + avatar, shows an admin badge, and — for group admins — a
/// menu to make / unmake admin and remove the member.
class MemberTile extends ConsumerWidget {
  final String userId;
  final bool isMemberAdmin;
  final bool canRemove;
  final bool isSelf;

  /// Whether the caller may change this member's admin role.
  final bool canManage;
  final VoidCallback onRemove;
  final VoidCallback? onPromote;
  final VoidCallback? onDemote;

  const MemberTile({
    super.key,
    required this.userId,
    required this.isMemberAdmin,
    required this.canRemove,
    required this.isSelf,
    required this.onRemove,
    this.canManage = false,
    this.onPromote,
    this.onDemote,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final isBot = userId == kAiBotUserId || userId.startsWith('extbot:');
    final profile =
        isBot ? null : ref.watch(userProfileProvider(userId)).valueOrNull;
    final name = isSelf
        ? l10n.you
        : isBot
            ? l10n.aiAssistant
            : (profile?.displayName ?? '…');
    final accent = AppTheme.accent(context);
    final canToggleAdmin = canManage && !isBot;
    final showMenu = canToggleAdmin || canRemove;
    return ListTile(
      leading: ConversationAvatar(
        avatarUrl: profile?.avatarUrl,
        fallbackLetter: name.isNotEmpty ? name[0].toUpperCase() : '?',
        size: 40,
      ),
      title: Row(
        children: [
          Flexible(
            child: Text(
              name,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
            ),
          ),
          if (isMemberAdmin) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                l10n.admin,
                style: TextStyle(
                    color: accent, fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ],
      ),
      trailing: showMenu
          ? PopupMenuButton<_MemberAction>(
              icon: const Icon(Icons.more_vert_rounded),
              onSelected: (action) {
                switch (action) {
                  case _MemberAction.promote:
                    onPromote?.call();
                  case _MemberAction.demote:
                    onDemote?.call();
                  case _MemberAction.remove:
                    onRemove();
                }
              },
              itemBuilder: (_) => [
                if (canToggleAdmin && !isMemberAdmin)
                  PopupMenuItem(
                    value: _MemberAction.promote,
                    child: Text(l10n.groupMakeAdmin),
                  ),
                if (canToggleAdmin && isMemberAdmin)
                  PopupMenuItem(
                    value: _MemberAction.demote,
                    child: Text(l10n.groupRemoveAdmin),
                  ),
                if (canRemove)
                  PopupMenuItem(
                    value: _MemberAction.remove,
                    child: Text(
                      l10n.removeMember,
                      style:
                          TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
                  ),
              ],
            )
          : null,
    );
  }
}
