import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'file_content.dart';
import 'floating_reaction_sheet.dart';
import 'image_content.dart';
import 'message_bubble_parts.dart';
import 'text_content.dart';
import 'voice_message_bubble.dart';

class MessageBubble extends ConsumerWidget {
  final MessageModel message;
  final bool isSentByMe;
  final String? otherUserId;
  final bool showSenderName;
  final bool highlighted;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isSentByMe,
    this.otherUserId,
    this.showSenderName = false,
    this.highlighted = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (message.isSystem) {
      return SystemMessage(message: message);
    }

    final locale = Localizations.localeOf(context).languageCode;
    final timeStr = DateFormat.Hm(locale).format(message.createdAt.toLocal());

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      builder: (context, animValue, child) => Opacity(
        opacity: message.isPending ? 0.5 : animValue,
        child: Transform.translate(
          offset: Offset(0, 12 * (1.0 - animValue)),
          child: child,
        ),
      ),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 400),
        color: highlighted
            ? AppTheme.ponCyan.withValues(alpha: 0.12)
            : Colors.transparent,
        child: Align(
          alignment:
              isSentByMe ? Alignment.centerRight : Alignment.centerLeft,
          child: Column(
            crossAxisAlignment: isSentByMe
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            children: [
              if (showSenderName && !isSentByMe)
                GroupSenderHeader(
                  userId: message.senderId,
                  conversationId: message.conversationId,
                ),
              GestureDetector(
                onLongPress: message.recalled
                    ? null
                    : () => FloatingReactionSheet.show(
                        context, ref, message, isSentByMe),
                onDoubleTap: message.recalled
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
                          gradient: isSentByMe && !message.recalled
                              ? const LinearGradient(
                                  colors: [
                                    AppTheme.ponCyan,
                                    AppTheme.ponPeach
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                )
                              : null,
                          color: isSentByMe && !message.recalled
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
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (message.replyPreview != null &&
                          !message.recalled)
                        ReplyQuote(preview: message.replyPreview!),
                      if (message.recalled)
                        Text(
                          context.l10n.messageRecalled,
                          style: TextStyle(
                            color:
                                Colors.white.withValues(alpha: 0.55),
                            fontSize: 14,
                            fontStyle: FontStyle.italic,
                          ),
                        )
                      else if (message.isSticker)
                        Text(
                          message.content,
                          style: const TextStyle(fontSize: 100, height: 1.1),
                        )
                      else if (message.isImage)
                        ImageContent(url: message.content)
                      else if (message.isVideo)
                        VideoContent(url: message.content)
                      else if (message.isVoice)
                        VoiceMessageBubble(
                          audioUrl: message.content,
                          isSentByMe: isSentByMe,
                        )
                      else if (message.isFile)
                        FileContent(
                            message: message, isSentByMe: isSentByMe)
                      else
                        TextContent(
                          content: message.content,
                          isSentByMe: isSentByMe,
                          mentions: message.mentions,
                        ),
                      const SizedBox(height: 5),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            timeStr,
                            style: TextStyle(
                              fontSize: 9.5,
                              color: isSentByMe
                                  ? Colors.white.withValues(alpha: 0.65)
                                  : Colors.white
                                      .withValues(alpha: 0.35),
                            ),
                          ),
                          if (message.isEdited &&
                              !message.recalled) ...[
                            const SizedBox(width: 4),
                            Text(
                              context.l10n.messageEdited,
                              style: TextStyle(
                                fontSize: 9.5,
                                fontStyle: FontStyle.italic,
                                color: isSentByMe
                                    ? Colors.white
                                        .withValues(alpha: 0.65)
                                    : Colors.white
                                        .withValues(alpha: 0.35),
                              ),
                            ),
                          ],
                          if (isSentByMe && !message.recalled) ...[
                            const SizedBox(width: 4),
                            _buildReadTick(),
                          ],
                        ],
                      ),
                    ],
                  ),
                  ),
                ),
              ),
              if (message.reactions.isNotEmpty && !message.recalled)
                ReactionChips(message: message),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildReadTick() {
    final isRead =
        otherUserId != null && message.readBy.contains(otherUserId);
    return Icon(
      isRead ? Icons.done_all_rounded : Icons.done_rounded,
      size: 13,
      color: isRead
          ? AppTheme.ponCyan
          : Colors.white.withValues(alpha: 0.4),
    );
  }
}
