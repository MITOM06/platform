import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../data/chat_repository.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import 'widgets/conversation_avatar.dart';
import 'widgets/pinned_messages_section.dart';

/// Loads a single conversation (used for group info, refreshed on demand).
final groupConversationProvider =
    FutureProvider.autoDispose.family<ConversationModel, String>((ref, id) {
  return ref.read(chatRepositoryProvider).getConversation(id);
});

class GroupInfoScreen extends ConsumerWidget {
  final String conversationId;

  const GroupInfoScreen({super.key, required this.conversationId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final convAsync = ref.watch(groupConversationProvider(conversationId));
    final auth = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId = auth is AuthAuthenticated ? auth.user.id : '';

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.groupInfo)),
      body: convAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(friendlyError(e),
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ),
        data: (conv) {
          final colorScheme = Theme.of(context).colorScheme;
          final isDark = Theme.of(context).brightness == Brightness.dark;
          final dividerColor =
              isDark ? Colors.white12 : Colors.black.withValues(alpha: 0.08);
          final isAdmin = conv.admins.contains(currentUserId);
          return ListView(
            children: [
              const SizedBox(height: 16),
              Center(
                child: GestureDetector(
                  onTap:
                      isAdmin ? () => _uploadGroupAvatar(context, ref) : null,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      ConversationAvatar(
                        avatarUrl: conv.avatarUrl,
                        fallbackLetter: (conv.name?.isNotEmpty ?? false)
                            ? conv.name![0].toUpperCase()
                            : '?',
                        isGroup: true,
                        size: 88,
                      ),
                      if (isAdmin)
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: const BoxDecoration(
                              color: AppTheme.ponCyan,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.camera_alt,
                                color: Colors.white, size: 16),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  conv.name ?? context.l10n.conversationDefault,
                  style: TextStyle(
                      color: colorScheme.onSurface,
                      fontSize: 20,
                      fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 4),
              Center(
                child: Text(
                  context.l10n.membersCount(conv.participants.length),
                  style: TextStyle(color: colorScheme.onSurfaceVariant),
                ),
              ),
              const SizedBox(height: 16),
              if (isAdmin)
                ListTile(
                  leading:
                      const Icon(Icons.edit_rounded, color: AppTheme.ponCyan),
                  title: Text(context.l10n.renameGroup,
                      style: TextStyle(color: colorScheme.onSurface)),
                  onTap: () => _renameGroup(context, ref, conv),
                ),
              if (isAdmin)
                ListTile(
                  leading: const Icon(Icons.person_add_alt_1_rounded,
                      color: AppTheme.ponCyan),
                  title: Text(context.l10n.addMembers,
                      style: TextStyle(color: colorScheme.onSurface)),
                  onTap: () => _addMember(context, ref),
                ),
              Divider(color: dividerColor),
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Text(
                  context.l10n.members,
                  style: TextStyle(
                    color: colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ),
              for (final memberId in conv.participants)
                _MemberTile(
                  userId: memberId,
                  isMemberAdmin: conv.admins.contains(memberId),
                  canRemove: isAdmin && memberId != currentUserId,
                  isSelf: memberId == currentUserId,
                  onRemove: () => _removeMember(context, ref, memberId),
                ),
              // Pinned messages (Task 53). Prefer the live chat-state list so
              // unpins reflect immediately; fall back to the loaded snapshot.
              Builder(builder: (context) {
                final liveState =
                    ref.watch(chatNotifierProvider(conversationId)).valueOrNull;
                final pinned = liveState?.pinnedMessages.isNotEmpty == true
                    ? liveState!.pinnedMessages
                    : conv.pinnedMessages;
                if (pinned.isEmpty) return const SizedBox.shrink();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Divider(color: dividerColor),
                    PinnedMessagesSection(
                      conversationId: conversationId,
                      pinnedMessages: pinned,
                    ),
                  ],
                );
              }),
              Divider(color: dividerColor),
              ListTile(
                leading: const Icon(Icons.perm_media_outlined,
                    color: AppTheme.ponCyan),
                title: Text(context.l10n.sharedMediaTitle,
                    style: TextStyle(color: colorScheme.onSurface)),
                trailing: Icon(Icons.chevron_right,
                    color: colorScheme.onSurfaceVariant),
                onTap: () => context.push('/shared-media/$conversationId'),
              ),
              if (isAdmin) ...[
                Divider(color: dividerColor),
                ListTile(
                  leading: const Icon(Icons.smart_toy_outlined,
                      color: AppTheme.ponCyan),
                  title: Text(context.l10n.configureAiPersona,
                      style: TextStyle(color: colorScheme.onSurface)),
                  trailing: Icon(Icons.chevron_right,
                      color: colorScheme.onSurfaceVariant),
                  onTap: () => context.push('/ai-persona/$conversationId'),
                ),
              ],
              Divider(color: dividerColor),
              ListTile(
                leading:
                    const Icon(Icons.logout_rounded, color: Colors.redAccent),
                title: Text(context.l10n.leaveGroup,
                    style: const TextStyle(color: Colors.redAccent)),
                onTap: () => _leaveGroup(context, ref, currentUserId),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _renameGroup(
      BuildContext context, WidgetRef ref, ConversationModel conv) async {
    final controller = TextEditingController(text: conv.name ?? '');
    final String? newName;
    try {
      newName = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppTheme.darkSurface,
          title: Text(ctx.l10n.renameGroup,
              style: const TextStyle(color: Colors.white)),
          content: TextField(
            controller: controller,
            autofocus: true,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(hintText: ctx.l10n.groupName),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(ctx.l10n.actionCancel),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, controller.text.trim()),
              child: Text(ctx.l10n.actionSave),
            ),
          ],
        ),
      );
    } finally {
      controller.dispose();
    }
    if (newName == null || newName.isEmpty) return;
    try {
      await ref
          .read(chatRepositoryProvider)
          .updateConversation(conversationId, name: newName);
      ref.invalidate(groupConversationProvider(conversationId));
      // Also refresh the conversation list + app-bar so the new name shows there.
      ref.invalidate(conversationsNotifierProvider);
    } catch (e) {
      if (context.mounted) {
        showErrorSnackBar(context.l10n.listGenericError);
      }
    }
  }

  Future<void> _uploadGroupAvatar(BuildContext context, WidgetRef ref) async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile == null) return;

    try {
      final url = await ref.read(chatRepositoryProvider).uploadFile(pickedFile);
      await ref
          .read(chatRepositoryProvider)
          .updateConversation(conversationId, avatarUrl: url);
      ref.invalidate(groupConversationProvider(conversationId));
      ref.invalidate(conversationsNotifierProvider);
    } catch (e) {
      if (context.mounted) {
        showErrorSnackBar(context.l10n.uploadFailed);
      }
    }
  }

  Future<void> _addMember(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final String? email;
    try {
      email = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppTheme.darkSurface,
          title: Text(ctx.l10n.addMembers,
              style: const TextStyle(color: Colors.white)),
          content: TextField(
            controller: controller,
            autofocus: true,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(hintText: ctx.l10n.searchUsers),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(ctx.l10n.actionCancel),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, controller.text.trim()),
              child: Text(ctx.l10n.actionConfirm),
            ),
          ],
        ),
      );
    } finally {
      controller.dispose();
    }
    if (email == null || email.isEmpty) return;
    final query = email;
    try {
      final users = await ref.read(authRepositoryProvider).searchUsers(query);
      final matches =
          users.where((u) => u.email.toLowerCase() == query.toLowerCase());
      final user = matches.isNotEmpty
          ? matches.first
          : (users.isNotEmpty ? users.first : null);
      if (user == null) {
        if (context.mounted) {
          showErrorSnackBar(context.l10n.errUserNotFoundEmail);
        }
        return;
      }
      await ref
          .read(chatRepositoryProvider)
          .addMembers(conversationId, [user.id]);
      ref.invalidate(groupConversationProvider(conversationId));
      ref.invalidate(conversationsNotifierProvider);
    } catch (e) {
      if (context.mounted) {
        showErrorSnackBar(context.l10n.listGenericError);
      }
    }
  }

  Future<void> _removeMember(
      BuildContext context, WidgetRef ref, String userId) async {
    try {
      await ref
          .read(chatRepositoryProvider)
          .removeMember(conversationId, userId);
      ref.invalidate(groupConversationProvider(conversationId));
    } catch (e) {
      if (context.mounted) {
        showErrorSnackBar(context.l10n.listGenericError);
      }
    }
  }

  Future<void> _leaveGroup(
      BuildContext context, WidgetRef ref, String currentUserId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.darkSurface,
        title: Text(ctx.l10n.leaveGroup,
            style: const TextStyle(color: Colors.white)),
        content: Text(ctx.l10n.leaveGroupConfirm,
            style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(ctx.l10n.actionCancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(ctx.l10n.actionLeave),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ref
          .read(chatRepositoryProvider)
          .removeMember(conversationId, currentUserId);
      ref.read(conversationsNotifierProvider.notifier).refresh();
      if (context.mounted) context.go('/');
    } catch (e) {
      if (context.mounted) {
        showErrorSnackBar(context.l10n.listGenericError);
      }
    }
  }
}

class _MemberTile extends ConsumerWidget {
  final String userId;
  final bool isMemberAdmin;
  final bool canRemove;
  final bool isSelf;
  final VoidCallback onRemove;

  const _MemberTile({
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
