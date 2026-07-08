import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../chat/data/chat_repository.dart';
import '../../chat/domain/chat_provider.dart';
import '../../chat/ui/widgets/conversation_avatar.dart';
import '../../friends/data/friends_repository.dart';
import '../../friends/domain/friends_provider.dart';
import 'widgets/user_profile_parts.dart';
import 'widgets/user_profile_relationship_actions.dart';

/// Public profile of any user: cover photo, avatar, name, bio, friend count,
/// and actions to message or send a friend request.
class UserProfileScreen extends ConsumerStatefulWidget {
  final String userId;
  /// When navigating from a chat context, pass the DM conversation id to enable
  /// the Shared Media button.
  final String? conversationId;
  const UserProfileScreen({super.key, required this.userId, this.conversationId});

  @override
  ConsumerState<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends ConsumerState<UserProfileScreen> {
  bool _busy = false;

  Future<void> _message(UserModel user) async {
    setState(() => _busy = true);
    try {
      final conv = await ref
          .read(chatRepositoryProvider)
          .getOrCreateConversation(user.id);
      if (mounted) context.go('/chat/${conv.id}');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyError(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Runs a friend/block action then refreshes the relationship so the buttons
  /// reflect the new state. Shows [successMsg] on success when provided.
  Future<void> _run(Future<void> Function() action, {String? successMsg}) async {
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      ref.invalidate(relationshipProvider(widget.userId));
      if (successMsg != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(successMsg)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyError(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _onFriendAction(RelationshipState rel) async {
    final repo = ref.read(friendsRepositoryProvider);
    switch (rel.friendStatus) {
      case 'accepted':
        final ok = await _confirm(
            context.l10n.unfriend, context.l10n.unfriendConfirm);
        if (ok == true) await _run(() => repo.removeFriend(widget.userId));
      case 'outgoing':
        // Tapping the pending button cancels the outgoing request.
        await _run(() => repo.removeFriend(widget.userId));
      case 'incoming':
        await _run(() => repo.acceptRequest(widget.userId));
      default:
        await _run(() => repo.sendRequest(widget.userId),
            successMsg: context.l10n.friendRequestSent);
    }
  }

  Future<void> _onBlockAction(RelationshipState rel) async {
    final repo = ref.read(friendsRepositoryProvider);
    final l10n = context.l10n;
    if (rel.iBlocked) {
      await _run(() => repo.unblockUser(widget.userId),
          successMsg: l10n.userUnblocked);
    } else {
      final ok = await _confirm(l10n.blockUser, l10n.blockUserConfirm);
      if (ok == true) {
        await _run(() => repo.blockUser(widget.userId),
            successMsg: l10n.userBlocked);
      }
    }
  }

  Future<bool?> _confirm(String title, String body) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(ctx.l10n.actionCancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(ctx.l10n.actionConfirm),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(userProfileProvider(widget.userId));
    final status = ref.watch(userStatusProvider(widget.userId));
    final me = ref.watch(authNotifierProvider).valueOrNull;
    final myId = me is AuthAuthenticated ? me.user.id : null;
    final isSelf = myId == widget.userId;
    final online = status.valueOrNull?.online ?? false;

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.profileTitle)),
      body: profile.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(friendlyError(e)),
        ),
        data: (user) => ListView(
          children: [
            ProfileCover(coverPhoto: user.coverPhoto),
            Transform.translate(
              offset: const Offset(0, -48),
              child: Column(
                children: [
                  ConversationAvatar(
                    avatarUrl: user.avatarUrl,
                    fallbackLetter: user.displayName.isNotEmpty
                        ? user.displayName[0].toUpperCase()
                        : '?',
                    size: 96,
                    online: online,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    user.displayName,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  // When the profile owner has blocked the viewer, show only
                  // minimal info: avatar, cover, name, email. Hide bio, friend
                  // count, and action buttons per the no-raw-system-data rule.
                  if (user.isBlockedByOwner) ...[
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(
                        user.email,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.6),
                          fontSize: 13,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(
                        context.l10n.profileBlockedByOwner,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.45),
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ] else ...[
                  // Role — always shown as the first info row (mirrors web).
                  // Falls back to the localized "Member" default.
                  ProfileCenteredInfoRow(
                    icon: Icons.work_outline,
                    value: user.roleName ?? context.l10n.profileRoleMemberDefault,
                  ),
                  if (user.friendsCount != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      context.l10n.friendsCountLabel(user.friendsCount!),
                      style: TextStyle(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withValues(alpha: 0.6),
                      ),
                    ),
                  ],
                  if (user.bio != null && user.bio!.trim().isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(
                        user.bio!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.8),
                        ),
                      ),
                    ),
                  ],
                  if (user.dateOfBirth != null &&
                      (isSelf || user.effectiveShowDateOfBirth)) ...[
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.cake_outlined, size: 16, color: Colors.white60),
                        const SizedBox(width: 6),
                        Text(
                          DateFormat.yMMMd().format(user.dateOfBirth!.toLocal()),
                          style: const TextStyle(color: Colors.white60, fontSize: 13.5),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 24),
                  if (isSelf)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: PonButton(
                        onPressed: () => context.push('/edit-profile'),
                        child: Text(context.l10n.editProfile),
                      ),
                    )
                  else
                    RelationshipActions(
                      userId: widget.userId,
                      busy: _busy,
                      onMessage: () => _message(user),
                      onFriendAction: _onFriendAction,
                      onBlockAction: _onBlockAction,
                    ),
                  if (!isSelf && widget.conversationId != null) ...[
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: ListTile(
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                        tileColor: Theme.of(context).colorScheme.surface,
                        leading: const Icon(Icons.perm_media_outlined),
                        title: Text(context.l10n.sharedMediaTitle),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context
                            .push('/shared-media/${widget.conversationId}'),
                      ),
                    ),
                  ],
                  ], // end else (not isBlockedByOwner)
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
