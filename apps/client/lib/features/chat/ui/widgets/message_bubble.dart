import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/motion.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import '../../domain/message_selection_provider.dart';
import 'ai_message_parts.dart';
import 'floating_reaction_sheet.dart';
import 'meeting_summary_card.dart';
import 'message_bubble_body.dart';
import 'message_bubble_parts.dart';
import 'message_feedback.dart';
import 'send_failed_retry.dart';

class MessageBubble extends ConsumerWidget {
  final MessageModel message;
  final bool isSentByMe;
  final String? otherUserId;
  final bool showSenderName;
  final bool highlighted;
  final bool isGroup;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isSentByMe,
    this.otherUserId,
    this.showSenderName = false,
    this.highlighted = false,
    this.isGroup = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (message.isSystem) {
      return SystemMessage(message: message);
    }
    if (message.isMeetingSummary) {
      return MeetingSummaryBubble(message: message);
    }
    // Bot Factory personal assistant — distinct identity, derived from
    // assistantProvider inside ExternalBotBubble.
    if (message.isExternalBot) {
      return ExternalBotBubble(message: message);
    }

    final chatState = ref
        .watch(chatNotifierProvider(message.conversationId))
        .valueOrNull;
    final aiPersonaName = chatState?.aiPersonaName ?? 'PON AI';
    final aiPersonaAvatarUrl = chatState?.aiPersonaAvatarUrl;

    // Multi-select: in select mode a tap toggles selection instead of opening
    // the reaction sheet, and the selected bubble is tinted with a check badge.
    final selectMode = ref.watch(messageSelectionProvider(message.conversationId)
        .select((s) => s.active));
    final isSelected = ref.watch(messageSelectionProvider(message.conversationId)
        .select((s) => s.selectedIds.contains(message.id)));

    final locale = Localizations.localeOf(context).languageCode;
    final timeStr = DateFormat.Hm(locale).format(message.createdAt.toLocal());

    // Entrance plays once per message (stable list keys keep the bubble's
    // element/state across rebuilds, so scroll/rebuild never re-triggers it,
    // and historical/paged-in messages aren't restaged either).
    // Reduced-motion → render the final frame.
    final reduced = AppMotion.reduced(context);
    // Isolate each bubble's paint so list updates / neighbouring repaints
    // don't churn this bubble's layer.
    return RepaintBoundary(
      child: TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: reduced ? 1.0 : 0.0, end: 1.0),
      duration: reduced ? Duration.zero : AppMotion.base,
      curve: AppMotion.settle,
      builder: (context, animValue, child) {
        // Outgoing = small "pop from input" (scale 0.96→1 + slide-up 10px);
        // incoming = fade + slide-up 8px.
        final slide = (isSentByMe ? 10.0 : 8.0) * (1.0 - animValue);
        final scale = isSentByMe ? 0.96 + 0.04 * animValue : 1.0;
        return Opacity(
          opacity: message.isPending ? 0.5 : animValue,
          child: Transform.translate(
            offset: Offset(0, slide),
            child: Transform.scale(
              scale: scale,
              alignment:
                  isSentByMe ? Alignment.bottomRight : Alignment.bottomLeft,
              child: child,
            ),
          ),
        );
      },
      child: AnimatedContainer(
        duration: AppMotion.slow,
        color: (selectMode && isSelected)
            ? AppTheme.ponCyan.withValues(alpha: 0.18)
            : highlighted
                ? AppTheme.ponCyan.withValues(alpha: 0.12)
                : Colors.transparent,
        child: selectMode
            ? GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => _toggleSelect(context, ref),
                child: Row(
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(left: 12),
                      child: _SelectCheck(selected: isSelected),
                    ),
                    Expanded(child: _bubble(context, ref, selectMode, timeStr,
                        aiPersonaName, aiPersonaAvatarUrl)),
                  ],
                ),
              )
            : _bubble(context, ref, selectMode, timeStr, aiPersonaName,
                aiPersonaAvatarUrl),
      ),
    ),
    );
  }

  void _toggleSelect(BuildContext context, WidgetRef ref) {
    final rejected = ref
        .read(messageSelectionProvider(message.conversationId).notifier)
        .toggle(message.id, message.type);
    if (rejected != null) {
      final l10n = context.l10n;
      final typeLabel = switch (rejected) {
        SelectionGroup.image => l10n.msgTypeImage,
        SelectionGroup.file => l10n.msgTypeFile,
        SelectionGroup.text => l10n.msgTypeText,
      };
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.multiSelectTypeWarning(typeLabel))),
      );
    }
  }

  Widget _bubble(
    BuildContext context,
    WidgetRef ref,
    bool selectMode,
    String timeStr,
    String aiPersonaName,
    String? aiPersonaAvatarUrl,
  ) {
    return Align(
          alignment:
              isSentByMe ? Alignment.centerRight : Alignment.centerLeft,
          child: Column(
            crossAxisAlignment: isSentByMe
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            children: [
              if (showSenderName && !isSentByMe && !message.isAiBot)
                GroupSenderHeader(
                  userId: message.senderId,
                  conversationId: message.conversationId,
                ),
              if (!isSentByMe && message.isAiBot)
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AiBotAvatar(avatarUrl: aiPersonaAvatarUrl),
                      const SizedBox(width: 6),
                      Text(
                        aiPersonaName,
                        style: TextStyle(
                          fontSize: 11,
                          color: const Color(0xFFB47FFF).withValues(alpha: 0.9),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              GestureDetector(
                onLongPress: selectMode
                    ? null
                    : (message.recalled || message.isAiMessage)
                        ? (message.isAiMessage && !message.isStreaming
                            ? () => FloatingReactionSheet.show(
                                context, ref, message, isSentByMe)
                            : null)
                        : () => FloatingReactionSheet.show(
                            context, ref, message, isSentByMe),
                onDoubleTap: (selectMode || message.recalled)
                    ? null
                    : () {
                        ref
                            .read(chatNotifierProvider(message.conversationId)
                                .notifier)
                            .toggleReaction(message.id, '❤️');
                      },
                // Constrain to the available pane width (LayoutBuilder), NOT the
                // full window — on the web split layout MediaQuery reports the
                // whole window, which made sent bubbles overflow/clip the pane.
                child: LayoutBuilder(
                  builder: (context, constraints) => Container(
                  margin: EdgeInsets.only(
                    // Right margin so sent bubbles never touch the edge (Task 74).
                    left: isSentByMe ? 40 : 16,
                    right: isSentByMe ? 16 : 40,
                    top: 3,
                    bottom: 3,
                  ),
                  constraints: BoxConstraints(
                    maxWidth: constraints.maxWidth * 0.82,
                  ),
                  decoration: (message.isSticker && !message.recalled)
                      ? null
                      : BoxDecoration(
                          gradient: isSentByMe && !message.recalled && !message.isAiMessage
                              ? const LinearGradient(
                                  colors: [
                                    AppTheme.ponCyan,
                                    AppTheme.ponPeach
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                )
                              : null,
                          color: message.isAiError ||
                                  message.isAiStreamInterrupted ||
                                  message.isAiUnavailable
                              ? const Color(0xFF3D1515)
                              : message.isAiQuotaExceeded ||
                                      message.isAiRateLimited
                                  ? const Color(0xFF3D2800)
                                  : message.isAiMessage && !message.recalled
                                      ? const Color(0xFF2D1B69)
                                  : isSentByMe && !message.recalled
                                      ? null
                                      : AppTheme.darkSurface.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.only(
                            topLeft: const Radius.circular(20),
                            topRight: const Radius.circular(20),
                            bottomLeft:
                                Radius.circular(isSentByMe ? 20 : 4),
                            bottomRight:
                                Radius.circular(isSentByMe ? 4 : 20),
                          ),
                          border: isSentByMe && !message.recalled
                              ? null
                              : Border.all(
                                  color: AppTheme.darkBorder
                                      .withValues(alpha: 0.4),
                                  width: 1,
                                ),
                        ),
                  padding: (message.isSticker && !message.recalled)
                      ? const EdgeInsets.symmetric(horizontal: 8, vertical: 4)
                      : message.isMedia && !message.recalled
                          ? const EdgeInsets.all(4)
                          : const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 11),
                  child: MessageBubbleBody(
                    message: message,
                    isSentByMe: isSentByMe,
                    otherUserId: otherUserId,
                    isGroup: isGroup,
                    timeStr: timeStr,
                  ),
                  ),
                ),
              ),
              // Optimistic send failed (no STOMP echo within the watchdog
              // window) — offer a tap-to-retry affordance.
              if (isSentByMe && message.sendFailed)
                SendFailedRetry(
                  conversationId: message.conversationId,
                  messageId: message.id,
                ),
              // 👍/👎 feedback only on finalized, successful AI answers.
              if (message.isAiMessage &&
                  !message.isStreaming &&
                  !message.recalled &&
                  !message.isAiError &&
                  !message.isAiQuotaExceeded &&
                  !message.isAiRateLimited &&
                  !message.isAiStreamInterrupted &&
                  !message.isAiUnavailable)
                Padding(
                  padding: const EdgeInsets.only(left: 16, right: 40),
                  child: MessageFeedback(messageId: message.id),
                ),
              if (message.reactions.isNotEmpty && !message.recalled)
                ReactionChips(message: message),
            ],
          ),
        );
  }
}

/// The selection check circle shown to the left of each bubble while
/// multi-select is active.
class _SelectCheck extends StatelessWidget {
  final bool selected;
  const _SelectCheck({required this.selected});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? AppTheme.ponCyan : Colors.transparent,
        border: Border.all(
          color: selected
              ? AppTheme.ponCyan
              : Theme.of(context).brightness == Brightness.dark
                  ? Colors.white38
                  : Colors.black38,
          width: 1.5,
        ),
      ),
      child: selected
          ? const Icon(Icons.check, size: 14, color: Colors.white)
          : null,
    );
  }
}
