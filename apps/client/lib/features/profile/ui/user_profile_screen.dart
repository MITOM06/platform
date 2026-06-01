import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../chat/data/chat_repository.dart';
import '../../chat/domain/chat_provider.dart';
import '../../chat/ui/widgets/conversation_avatar.dart';
import '../../friends/data/friends_repository.dart';
import '../../friends/domain/friends_provider.dart';

/// Public profile of any user: cover photo, avatar, name, bio, friend count,
/// and actions to message or send a friend request.
class UserProfileScreen extends ConsumerStatefulWidget {
  final String userId;
  const UserProfileScreen({super.key, required this.userId});

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
          SnackBar(content: Text(context.l10n.errorWithMsg(e.toString()))),
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
          SnackBar(content: Text(context.l10n.errorWithMsg(e.toString()))),
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
          child: Text(context.l10n.errorWithMsg(e.toString())),
        ),
        data: (user) => ListView(
          children: [
            _Cover(coverPhoto: user.coverPhoto),
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
                    _RelationshipActions(
                      userId: widget.userId,
                      busy: _busy,
                      onMessage: () => _message(user),
                      onFriendAction: _onFriendAction,
                      onBlockAction: _onBlockAction,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Message + friend + block buttons, driven by the live relationship state.
class _RelationshipActions extends ConsumerWidget {
  final String userId;
  final bool busy;
  final VoidCallback onMessage;
  final Future<void> Function(RelationshipState) onFriendAction;
  final Future<void> Function(RelationshipState) onBlockAction;

  const _RelationshipActions({
    required this.userId,
    required this.busy,
    required this.onMessage,
    required this.onFriendAction,
    required this.onBlockAction,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final relAsync = ref.watch(relationshipProvider(userId));
    final rel = relAsync.valueOrNull ??
        const RelationshipState(
            friendStatus: 'none', iBlocked: false, blockedMe: false);

    final String friendLabel;
    switch (rel.friendStatus) {
      case 'accepted':
        friendLabel = context.l10n.unfriend;
      case 'outgoing':
        friendLabel = context.l10n.friendRequestPending;
      case 'incoming':
        friendLabel = context.l10n.acceptFriend;
      default:
        friendLabel = context.l10n.addFriend;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: PonButton(
                  onPressed: busy ? null : onMessage,
                  child: Text(context.l10n.messageAction),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: PonButton(
                  gradientColors: const [AppTheme.ponPeach, AppTheme.ponPink],
                  glowColor: AppTheme.ponPink,
                  onPressed: busy ? null : () => onFriendAction(rel),
                  child: Text(friendLabel),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: TextButton.icon(
              onPressed: busy ? null : () => onBlockAction(rel),
              icon: Icon(
                rel.iBlocked ? Icons.lock_open_rounded : Icons.block_rounded,
                color: Colors.redAccent,
                size: 18,
              ),
              label: Text(
                rel.iBlocked ? context.l10n.unblockUser : context.l10n.blockUser,
                style: const TextStyle(color: Colors.redAccent),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Cover extends StatelessWidget {
  final String? coverPhoto;
  const _Cover({this.coverPhoto});

  @override
  Widget build(BuildContext context) {
    final hasCover = coverPhoto != null && coverPhoto!.isNotEmpty;
    final url = hasCover && coverPhoto!.startsWith('http')
        ? coverPhoto!
        : (hasCover ? '${DioClient.chatBaseUrl}$coverPhoto' : null);
    return Container(
      height: 160,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.ponCyan, AppTheme.ponPink],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: url != null
          ? CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.cover,
              width: double.infinity,
              errorWidget: (_, __, ___) => const SizedBox.shrink(),
            )
          : null,
    );
  }
}
