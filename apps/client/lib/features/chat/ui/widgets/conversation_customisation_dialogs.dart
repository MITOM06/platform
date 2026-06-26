import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';

void showQuickReactionDialog(BuildContext context, WidgetRef ref, String conversationId) {
  final emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '💯', '👏', '👀', '✨'];

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      backgroundColor: AppTheme.darkSurface,
      title: Text(context.l10n.quickReactionTitle, style: const TextStyle(color: Colors.white)),
      content: SizedBox(
        width: 250,
        child: GridView.builder(
          shrinkWrap: true,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
          ),
          itemCount: emojis.length,
          itemBuilder: (context, idx) {
            final emoji = emojis[idx];
            return GestureDetector(
              onTap: () {
                ref.read(quickReactionProvider(conversationId).notifier).setQuickReaction(emoji);
                ref.read(chatNotifierProvider(conversationId).notifier).sendMessage('system.quick_reaction.changed:$emoji', type: 'system');
                Navigator.pop(context);
              },
              child: Container(
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(emoji, style: const TextStyle(fontSize: 28)),
              ),
            );
          },
        ),
      ),
    ),
  );
}

/// Issue 3: single centered modal listing each participant (self + others for
/// 1:1, self + all members for groups). Each row shows the real account avatar
/// + display name, with the nickname (or a "no nickname" placeholder) and a
/// pencil that toggles an inline editor. Mirrors the web NicknamesModal.
/// Transport is unchanged: nicknames stay client-local, broadcast via
/// `system.nickname.changed:<userId>:<nickname>`.
void showNicknamesDialog(
  BuildContext context,
  WidgetRef ref,
  String conversationId,
  ConversationModel? conv,
) {
  if (conv == null) return;
  showDialog(
    context: context,
    builder: (_) => _NicknamesModal(
      conversationId: conversationId,
      participants: conv.participants,
    ),
  );
}

class _NicknamesModal extends ConsumerWidget {
  final String conversationId;
  final List<String> participants;

  const _NicknamesModal({
    required this.conversationId,
    required this.participants,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId =
        authState is AuthAuthenticated ? authState.user.id : '';
    // Self first, then the rest — matches the web ordering.
    final ordered = [
      ...participants.where((p) => p == currentUserId),
      ...participants.where((p) => p != currentUserId),
    ];

    return AlertDialog(
      backgroundColor: AppTheme.darkSurface,
      title: Text(context.l10n.nicknameModalTitle,
          style: const TextStyle(color: Colors.white)),
      content: SizedBox(
        width: 340,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final userId in ordered)
                _NicknameRow(
                  conversationId: conversationId,
                  userId: userId,
                  isSelf: userId == currentUserId,
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(context.l10n.actionOk,
              style: const TextStyle(color: Colors.white70)),
        ),
      ],
    );
  }
}

class _NicknameRow extends ConsumerStatefulWidget {
  final String conversationId;
  final String userId;
  final bool isSelf;

  const _NicknameRow({
    required this.conversationId,
    required this.userId,
    required this.isSelf,
  });

  @override
  ConsumerState<_NicknameRow> createState() => _NicknameRowState();
}

class _NicknameRowState extends ConsumerState<_NicknameRow> {
  bool _editing = false;
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    final nickname =
        ref.read(nicknamesProvider(widget.conversationId))[widget.userId] ?? '';
    _controller = TextEditingController(text: nickname);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _save() {
    final val = _controller.text.trim();
    ref
        .read(nicknamesProvider(widget.conversationId).notifier)
        .setNickname(widget.userId, val);
    ref
        .read(chatNotifierProvider(widget.conversationId).notifier)
        .sendMessage('system.nickname.changed:${widget.userId}:$val',
            type: 'system');
    setState(() => _editing = false);
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(userProfileProvider(widget.userId)).valueOrNull;
    final name = profile?.displayName ?? '...';
    final nicknames = ref.watch(nicknamesProvider(widget.conversationId));
    final nickname = nicknames[widget.userId] ?? '';
    final letter = name.isNotEmpty ? name[0].toUpperCase() : '?';

    final nameLabel =
        widget.isSelf ? '$name ${context.l10n.nicknameYouSuffix}' : name;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          ConversationAvatar(
            avatarUrl: profile?.avatarUrl,
            fallbackLetter: letter,
            size: 44,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  nameLabel,
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                if (_editing)
                  TextField(
                    controller: _controller,
                    autofocus: true,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: const InputDecoration(
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(vertical: 4),
                      enabledBorder: UnderlineInputBorder(
                          borderSide: BorderSide(color: Colors.white24)),
                      focusedBorder: UnderlineInputBorder(
                          borderSide: BorderSide(color: AppTheme.ponCyan)),
                    ),
                    onSubmitted: (_) => _save(),
                  )
                else
                  Text(
                    nickname.isNotEmpty
                        ? nickname
                        : context.l10n.nicknameNonePlaceholder,
                    style: TextStyle(
                      color: nickname.isNotEmpty
                          ? AppTheme.ponCyan
                          : Colors.white38,
                      fontSize: 13,
                      fontStyle: nickname.isNotEmpty
                          ? FontStyle.normal
                          : FontStyle.italic,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _editing
              ? IconButton(
                  icon: const Icon(Icons.check, color: AppTheme.ponCyan, size: 20),
                  onPressed: _save,
                )
              : IconButton(
                  icon: const Icon(Icons.edit_outlined,
                      color: Colors.white54, size: 18),
                  onPressed: () => setState(() => _editing = true),
                ),
        ],
      ),
    );
  }
}
