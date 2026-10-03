import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/motion.dart';
import '../../../profile/ui/widgets/user_profile_dialog.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';
import 'message_preview_text.dart';
import 'reactions_detail_modal.dart';

export 'system_message.dart';

/// Header shown above a received message bubble in group chats: the sender's
/// avatar followed by their display name (or custom nickname).
class GroupSenderHeader extends ConsumerWidget {
  final String userId;
  final String conversationId;
  const GroupSenderHeader({
    super.key,
    required this.userId,
    required this.conversationId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider(userId)).valueOrNull;
    final nicknames = ref.watch(nicknamesProvider(conversationId));
    final nickname = nicknames[userId];
    final name = (nickname != null && nickname.isNotEmpty)
        ? nickname
        : (profile?.displayName ?? '…');
    final letter =
        (name.isNotEmpty && name != '…') ? name[0].toUpperCase() : '?';
    return GestureDetector(
      onTap: () => showUserProfileDialog(context, userId),
      child: Padding(
        padding: const EdgeInsets.only(left: 16, top: 6, bottom: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ConversationAvatar(
              avatarUrl: profile?.avatarUrl,
              fallbackLetter: letter,
              size: 22,
            ),
            const SizedBox(width: 6),
            Text(
              name,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppTheme.accent(context).withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ReplyQuote extends StatelessWidget {
  final ReplyPreview preview;
  const ReplyQuote({super.key, required this.preview});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(8),
        border: Border(
          left: BorderSide(color: AppTheme.accent(context), width: 3),
        ),
      ),
      child: Text(
        // Sanitize per no-raw-system-data-in-ui: a reply can quote a media
        // message (raw /api/uploads/… URL or file JSON) or a system message
        // (raw system.* code). Humanize/label instead of showing it verbatim.
        messagePreviewFromContent(context, preview.content),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12,
          color: AppTheme.mutedText(context),
        ),
      ),
    );
  }
}

class ReactionChips extends StatelessWidget {
  final MessageModel message;
  const ReactionChips({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final counts = <String, int>{};
    for (final r in message.reactions) {
      counts.update(r.emoji, (v) => v + 1, ifAbsent: () => 1);
    }
    return Padding(
      padding: const EdgeInsets.only(left: 18, right: 18, bottom: 4),
      child: Wrap(
        spacing: 4,
        children: [
          for (final entry in counts.entries)
            // Keyed by emoji so a newly-added reaction pops in (scale 0→1,
            // easeOutBack); existing chips keep their state and don't re-fire.
            _ReactionChip(
              key: ValueKey(entry.key),
              emoji: entry.key,
              count: entry.value,
              onTap: () => showReactionsDetailModal(context, message),
            ),
        ],
      ),
    );
  }
}

/// A single reaction chip that pops in on first appearance (confirmation
/// motion). Reduced-motion → renders at full scale immediately.
class _ReactionChip extends StatelessWidget {
  final String emoji;
  final int count;
  final VoidCallback onTap;

  const _ReactionChip({
    super.key,
    required this.emoji,
    required this.count,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final reduced = AppMotion.reduced(context);
    return GestureDetector(
      onTap: onTap,
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(begin: reduced ? 1.0 : 0.0, end: 1.0),
        duration: reduced ? Duration.zero : AppMotion.fast,
        curve: AppMotion.pop,
        builder: (context, scale, child) =>
            Transform.scale(scale: scale, child: child),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: AppTheme.accent(context).withValues(alpha: 0.3),
              width: 1,
            ),
          ),
          child: Text(
            count > 1 ? '$emoji $count' : emoji,
            style: const TextStyle(fontSize: 12),
          ),
        ),
      ),
    );
  }
}

/// Per-user delivered/read tick shown on outgoing DM messages. Single tick =
/// delivered, double cyan tick = read by the other participant.
class ReadTick extends StatelessWidget {
  final MessageModel message;
  final String? otherUserId;

  const ReadTick({
    super.key,
    required this.message,
    required this.otherUserId,
  });

  @override
  Widget build(BuildContext context) {
    final isRead =
        otherUserId != null && message.readBy.contains(otherUserId);
    return Icon(
      isRead ? Icons.done_all_rounded : Icons.done_rounded,
      size: 13,
      color: isRead ? AppTheme.accent(context) : AppTheme.mutedText(context),
    );
  }
}
