import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../profile/ui/widgets/user_profile_dialog.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'conversation_avatar.dart';
import 'reactions_detail_modal.dart';

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
                color: AppTheme.ponCyan.withValues(alpha: 0.8),
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
        border: const Border(
          left: BorderSide(color: AppTheme.ponCyan, width: 3),
        ),
      ),
      child: Text(
        preview.content,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12.5,
          color: Colors.white.withValues(alpha: 0.7),
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
            GestureDetector(
              onTap: () => showReactionsDetailModal(context, message),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.darkSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppTheme.ponCyan.withValues(alpha: 0.3),
                    width: 1,
                  ),
                ),
                child: Text(
                  entry.value > 1
                      ? '${entry.key} ${entry.value}'
                      : entry.key,
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class SystemMessage extends ConsumerWidget {
  final MessageModel message;
  const SystemMessage({super.key, required this.message});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId = authState is AuthAuthenticated ? authState.user.id : '';
    final nicknames = ref.watch(nicknamesProvider(message.conversationId));

    final actorId = message.senderId;
    final actorProfile = ref.watch(userProfileProvider(actorId)).valueOrNull;
    final actorNickname = nicknames[actorId];
    final actorName = actorId == currentUserId
        ? context.l10n.you
        : ((actorNickname != null && actorNickname.isNotEmpty)
            ? actorNickname
            : (actorProfile?.displayName ?? '...'));

    String text = message.content;

    if (message.content.startsWith('system.nickname.changed:')) {
      final parts = message.content.split(':');
      if (parts.length >= 2) {
        final targetId = parts[1];
        final nickname = parts.length > 2 ? parts.sublist(2).join(':') : '';
        final targetProfile = ref.watch(userProfileProvider(targetId)).valueOrNull;
        final targetNickname = nicknames[targetId];
        final targetName = targetId == currentUserId
            ? context.l10n.you
            : ((targetNickname != null && targetNickname.isNotEmpty)
                ? targetNickname
                : (targetProfile?.displayName ?? '...'));

        if (nickname.isEmpty) {
          text = targetId == actorId
              ? context.l10n.sysNicknameClearedSelf(actorName)
              : context.l10n.sysNicknameClearedOther(actorName, targetName);
        } else {
          text = targetId == actorId
              ? context.l10n.sysNicknameSetSelf(actorName, nickname)
              : context.l10n
                  .sysNicknameSetOther(actorName, targetName, nickname);
        }
      }
    } else if (message.content.startsWith('system.theme.changed:')) {
      text = context.l10n.sysThemeChanged(actorName);
    } else if (message.content.startsWith('system.quick_reaction.changed:')) {
      final parts = message.content.split(':');
      final emoji = parts.length > 1 ? parts[1] : '👍';
      text = context.l10n.sysQuickReactionChanged(actorName, emoji);
    } else if (message.content.startsWith('system.message.pinned:') ||
        message.content.startsWith('system.message.unpinned:')) {
      // Format: `system.message.(un)pinned:<actorUserId>`. The actor id is
      // carried in the content (senderId is the generic "system" sender).
      final isUnpinned = message.content.startsWith('system.message.unpinned:');
      final parts = message.content.split(':');
      final pinActorId = parts.length > 1 ? parts[1] : '';
      final pinActorProfile =
          ref.watch(userProfileProvider(pinActorId)).valueOrNull;
      final pinActorNickname = nicknames[pinActorId];
      final pinActorName = pinActorId.isEmpty
          ? context.l10n.someone
          : (pinActorId == currentUserId
              ? context.l10n.you
              : ((pinActorNickname != null && pinActorNickname.isNotEmpty)
                  ? pinActorNickname
                  : (pinActorProfile?.displayName ?? context.l10n.someone)));
      text = isUnpinned
          ? context.l10n.sysUnpinnedMessage(pinActorName)
          : context.l10n.sysPinnedMessage(pinActorName);
    } else if (message.content.startsWith('system.call.')) {
      return _CallSystemMessage(content: message.content);
    } else {
      text = _systemText(context, message.content, actorName);
    }

    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 40),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11.5,
            color: Colors.white.withValues(alpha: 0.5),
          ),
        ),
      ),
    );
  }

  String _systemText(BuildContext context, String key, String actorName) {
    switch (key) {
      case 'system.group.created':
        return context.l10n.sysGroupCreated(actorName);
      case 'system.members.added':
        return context.l10n.sysMembersAdded(actorName);
      case 'system.member.left':
        return context.l10n.sysMemberLeft(actorName);
      case 'system.member.removed':
        return context.l10n.sysMemberRemoved(actorName);
      case 'system.member.joined':
        return context.l10n.sysMemberJoined(actorName);
      default:
        // Unknown system code — render nothing rather than a raw key string.
        return '';
    }
  }
}

/// Centered call-log system message with a phone/video icon. Renders
/// `system.call.ended:{kind}:{secs}` and `system.call.missed:{kind}`
/// (mirrors web MessageBubble / system-messages.ts).
class _CallSystemMessage extends StatelessWidget {
  final String content;
  const _CallSystemMessage({required this.content});

  @override
  Widget build(BuildContext context) {
    // `system.call.ended:{kind}:{secs}` -> parts = [system.call.ended, kind, secs]
    // `system.call.missed:{kind}`       -> parts = [system.call.missed, kind]
    final parts = content.split(':');
    final isMissed = content.startsWith('system.call.missed:');
    final callKind = parts.length > 1 ? parts[1] : 'voice';
    final isVideo = callKind == 'video';

    String text;
    if (isMissed) {
      text = isVideo
          ? context.l10n.systemVideoCallMissed
          : context.l10n.systemVoiceCallMissed;
    } else {
      final secs = int.tryParse(parts.length > 3 ? parts[3] : '0') ?? 0;
      final mm = (secs ~/ 60).toString().padLeft(2, '0');
      final ss = (secs % 60).toString().padLeft(2, '0');
      final duration = '$mm:$ss';
      text = isVideo
          ? context.l10n.systemVideoCallEnded(duration)
          : context.l10n.systemVoiceCallEnded(duration);
    }

    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 40),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isVideo ? Icons.videocam : Icons.call,
              size: 14,
              color: isMissed
                  ? Colors.redAccent.withValues(alpha: 0.8)
                  : Colors.white.withValues(alpha: 0.5),
            ),
            const SizedBox(width: 6),
            Text(
              text,
              style: TextStyle(
                fontSize: 11.5,
                color: Colors.white.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

