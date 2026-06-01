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
  bool _requestSent = false;

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

  Future<void> _addFriend() async {
    setState(() => _busy = true);
    try {
      await ref.read(friendsRepositoryProvider).sendRequest(widget.userId);
      if (mounted) {
        setState(() => _requestSent = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.friendRequestSent)),
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
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Row(
                        children: [
                          Expanded(
                            child: PonButton(
                              onPressed: _busy ? null : () => _message(user),
                              child: Text(context.l10n.messageAction),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: PonButton(
                              gradientColors: const [
                                AppTheme.ponPeach,
                                AppTheme.ponPink,
                              ],
                              glowColor: AppTheme.ponPink,
                              onPressed:
                                  (_busy || _requestSent) ? null : _addFriend,
                              child: Text(_requestSent
                                  ? context.l10n.friendRequestSent
                                  : context.l10n.addFriend),
                            ),
                          ),
                        ],
                      ),
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
