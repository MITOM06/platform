import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/data/auth_repository.dart';
import '../data/chat_repository.dart';
import '../domain/chat_provider.dart';
import '../domain/chat_state.dart';
import '../utils/chat_error.dart';

/// Loads a single conversation (group info fallback while the list loads).
final groupConversationProvider =
    FutureProvider.autoDispose.family<ConversationModel, String>((ref, id) {
  return ref.read(chatRepositoryProvider).getConversation(id);
});

/// Group-info mutations (rename, avatar, members, admins, leave). Split out of
/// group_info_screen.dart for the clean-code limit. Every failure shows the
/// specific localized reason (GROUP_ADMIN_REQUIRED, NOT_A_MEMBER,
/// LAST_ADMIN_CANNOT_BE_REMOVED, …) — never raw server text.
class GroupInfoActions {
  GroupInfoActions(this.context, this.ref, this.conversationId)
      : l10n = context.l10n;

  final BuildContext context;
  final WidgetRef ref;
  final String conversationId;

  /// Resolved up-front: messages are shown after network calls.
  final AppLocalizations l10n;

  /// Applies the server's copy everywhere it is shown.
  void _apply(ConversationModel updated) {
    ref.read(conversationsNotifierProvider.notifier).applyServerCopy(updated);
    ref.invalidate(groupConversationProvider(conversationId));
  }

  void _fail(Object e) => showErrorSnackBar(chatErrorMessage(l10n, e));

  Future<void> rename(ConversationModel conv) async {
    final controller = TextEditingController(text: conv.name ?? '');
    final String? newName;
    try {
      newName = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(ctx.l10n.renameGroup),
          content: TextField(
            controller: controller,
            autofocus: true,
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
      _apply(await ref
          .read(chatRepositoryProvider)
          .updateConversation(conversationId, name: newName));
    } catch (e) {
      _fail(e);
    }
  }

  Future<void> uploadAvatar() async {
    final pickedFile =
        await ImagePicker().pickImage(source: ImageSource.gallery);
    if (pickedFile == null) return;
    final String url;
    try {
      url = await ref.read(chatRepositoryProvider).uploadFile(pickedFile);
    } catch (_) {
      showErrorSnackBar(l10n.uploadFailed);
      return;
    }
    try {
      _apply(await ref
          .read(chatRepositoryProvider)
          .updateConversation(conversationId, avatarUrl: url));
    } catch (e) {
      _fail(e);
    }
  }

  /// Lists / unlists the group in Explore (admins; not for department groups).
  Future<void> setPublicChannel(bool value) async {
    try {
      _apply(await ref
          .read(chatRepositoryProvider)
          .updateConversation(conversationId, publicChannel: value));
    } catch (e) {
      _fail(e);
    }
  }

  /// Adds the member whose email EXACTLY matches the input. The old fallback
  /// to "first fuzzy search result" added the wrong person.
  Future<void> addMember() async {
    final controller = TextEditingController();
    final String? email;
    try {
      email = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(ctx.l10n.addMembers),
          content: TextField(
            controller: controller,
            autofocus: true,
            keyboardType: TextInputType.emailAddress,
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
    final query = email.toLowerCase();
    try {
      final users = await ref.read(authRepositoryProvider).searchUsers(email);
      final match = users.where((u) => u.email.toLowerCase() == query);
      if (match.isEmpty) {
        showErrorSnackBar(l10n.errUserNotFoundEmail);
        return;
      }
      _apply(await ref
          .read(chatRepositoryProvider)
          .addMembers(conversationId, [match.first.id]));
    } catch (e) {
      _fail(e);
    }
  }

  Future<void> removeMember(String userId) async {
    try {
      _apply(await ref
          .read(chatRepositoryProvider)
          .removeMember(conversationId, userId));
    } catch (e) {
      _fail(e);
    }
  }

  /// Promote ([makeAdmin] = true) or demote a member (admin-only).
  Future<void> setAdmin(String userId, {required bool makeAdmin}) async {
    final repo = ref.read(chatRepositoryProvider);
    try {
      _apply(makeAdmin
          ? await repo.promoteAdmin(conversationId, userId)
          : await repo.demoteAdmin(conversationId, userId));
    } catch (e) {
      _fail(e);
    }
  }

  Future<void> leave(String currentUserId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(ctx.l10n.leaveGroup),
        content: Text(ctx.l10n.leaveGroupConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(ctx.l10n.actionCancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(ctx.l10n.actionLeave),
          ),
        ],
      ),
    );
    if (confirm != true || !context.mounted) return;
    final router = GoRouter.of(context);
    try {
      await ref
          .read(chatRepositoryProvider)
          .removeMember(conversationId, currentUserId);
      ref.read(conversationsNotifierProvider.notifier).refresh();
      router.go('/');
    } catch (e) {
      _fail(e);
    }
  }
}
