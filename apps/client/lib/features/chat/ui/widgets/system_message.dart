import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'system_message_text.dart';

class SystemMessage extends ConsumerWidget {
  final MessageModel message;
  const SystemMessage({super.key, required this.message});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (message.content.startsWith('system.call.')) {
      return _CallSystemMessage(content: message.content);
    }
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final currentUserId = authState is AuthAuthenticated ? authState.user.id : '';
    final nicknames = ref.watch(nicknamesProvider(message.conversationId));
    final l10n = context.l10n;

    // "You" / nickname / display name — never the raw id. Ids that are not
    // users (the "system" sender, assistants) are never looked up.
    String resolveName(String userId) {
      if (userId.isEmpty || isSystemSender(userId)) return l10n.someone;
      if (userId == currentUserId) return l10n.you;
      if (userId == kAiBotUserId || userId.startsWith('extbot:')) {
        return l10n.aiAssistant;
      }
      final nickname = nicknames[userId];
      if (nickname != null && nickname.isNotEmpty) return nickname;
      final profile = ref.watch(userProfileProvider(userId)).valueOrNull;
      return profile?.displayName ?? l10n.someone;
    }

    // Unknown system code → render nothing rather than a raw key string.
    final text = systemMessageText(
      l10n,
      message.content,
      senderId: message.senderId,
      resolveName: resolveName,
    );
    if (text == null || text.isEmpty) return const SizedBox.shrink();

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

