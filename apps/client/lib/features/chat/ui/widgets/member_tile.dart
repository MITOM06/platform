import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import 'conversation_avatar.dart';

/// A single member row in the group-info member list. Resolves the member's
/// display name + avatar and shows an admin badge / remove action.
class MemberTile extends ConsumerWidget {
  final String userId;
  final bool isMemberAdmin;
  final bool canRemove;
  final bool isSelf;
  final VoidCallback onRemove;

  const MemberTile({
    super.key,
    required this.userId,
    required this.isMemberAdmin,
    required this.canRemove,
    required this.isSelf,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider(userId)).valueOrNull;
    final name = isSelf ? context.l10n.you : (profile?.displayName ?? '…');
    return ListTile(
      leading: ConversationAvatar(
        avatarUrl: profile?.avatarUrl,
        fallbackLetter: name.isNotEmpty ? name[0].toUpperCase() : '?',
        size: 40,
      ),
      title: Text(name,
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
      subtitle: isMemberAdmin
          ? Text(context.l10n.admin,
              style: const TextStyle(color: AppTheme.ponCyan, fontSize: 12))
          : null,
      trailing: canRemove
          ? IconButton(
              icon: const Icon(Icons.remove_circle_outline,
                  color: Colors.redAccent),
              onPressed: onRemove,
            )
          : null,
    );
  }
}
