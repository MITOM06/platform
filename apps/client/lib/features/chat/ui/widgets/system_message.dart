import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';

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
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.hairline(context), width: 1),
        ),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11,
            color: AppTheme.mutedText(context),
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
      // `system.call.ended:{kind}:{secs}` → secs is at index 2 (web parses the
      // same index). Reading parts[3] here always missed it → duration 00:00.
      final secs = int.tryParse(parts.length > 2 ? parts[2] : '0') ?? 0;
      final mm = (secs ~/ 60).toString().padLeft(2, '0');
      final ss = (secs % 60).toString().padLeft(2, '0');
      final duration = '$mm:$ss';
      text = isVideo
          ? context.l10n.systemVideoCallEnded(duration)
          : context.l10n.systemVoiceCallEnded(duration);
    }

    // Was a neutral surface pill with a muted-colour icon+text — visually a
    // different "species" from the accent-tinted call pill this replaced.
    // Now a single tinted pill (accent tint for ended calls, error tint for
    // missed) carrying both the icon and the text together, so there is only
    // ever one call-log element per call, and it always shows the icon.
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tintBg = isMissed
        ? Theme.of(context).colorScheme.error.withValues(alpha: 0.14)
        : (isDark ? AppTheme.darkAccentTint : AppTheme.lightAccentTint);
    final tintFg = isMissed
        ? Theme.of(context).colorScheme.error
        : (isDark ? AppTheme.darkTintFg : AppTheme.accent(context));

    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 40),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: tintBg,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isVideo ? Icons.videocam_rounded : Icons.call_rounded,
              size: 14,
              color: tintFg,
            ),
            const SizedBox(width: 6),
            Text(
              text,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: tintFg,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Historical `type: "call_log"` messages (chat-service stopped writing new
/// ones — see `ChatController` javadoc — but old rows still exist and still
/// render as a plain-text bubble via the generic text fallback). Give them the
/// same call icon as [_CallSystemMessage] so old and new call history read
/// consistently, instead of an icon-less line of English text sitting inside
/// an otherwise normal sent/received bubble.
class LegacyCallLogContent extends StatelessWidget {
  final String content;
  final bool isSentByMe;
  const LegacyCallLogContent({
    super.key,
    required this.content,
    required this.isSentByMe,
  });

  @override
  Widget build(BuildContext context) {
    final lower = content.toLowerCase();
    final isVideo = lower.contains('video');
    final isMissed = lower.contains('missed');
    final color = isSentByMe ? Colors.white : Theme.of(context).colorScheme.onSurface;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          isVideo ? Icons.videocam_rounded : Icons.call_rounded,
          size: 14,
          color: isMissed ? color.withValues(alpha: 0.85) : color,
        ),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            content,
            style: TextStyle(color: color, fontSize: 14, height: 1.35),
          ),
        ),
      ],
    );
  }
}

