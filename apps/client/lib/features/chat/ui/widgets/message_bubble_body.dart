import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/chat_state.dart';
import 'ai_message_parts.dart';
import 'file_content.dart';
import 'image_content.dart';
import 'message_bubble_parts.dart';
import 'streaming_ai_bubble.dart';
import 'text_content.dart';
import 'tool_trace_panel.dart';
import 'voice_message_bubble.dart';

/// The inner content column of a [MessageBubble]: reply quote, the type-specific
/// body (text / sticker / media / voice / file / AI states), and the footer row
/// (timestamp, edited marker, read tick). Extracted from message_bubble.dart to
/// keep that file under the clean-code line limit — behaviour is unchanged.
class MessageBubbleBody extends StatelessWidget {
  final MessageModel message;
  final bool isSentByMe;
  final String? otherUserId;
  final bool isGroup;
  final String timeStr;

  const MessageBubbleBody({
    super.key,
    required this.message,
    required this.isSentByMe,
    required this.otherUserId,
    required this.isGroup,
    required this.timeStr,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (message.replyPreview != null && !message.recalled)
          ReplyQuote(preview: message.replyPreview!),
        if (message.recalled)
          Text(
            context.l10n.messageRecalled,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.55),
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
          FileContent(message: message, isSentByMe: isSentByMe)
        else if (message.isAiMessage && message.isStreaming)
          StreamingAiBubble(
            content: message.content,
            isThinking: message.isThinking,
            activeTools: message.activeTools,
            sensitiveTools: message.sensitiveTools,
          )
        else if (message.isAiQuotaExceeded)
          const QuotaExceededBubble()
        else if (message.isAiRateLimited)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.hourglass_top_rounded,
                  color: Color(0xFFFFB74D), size: 16),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  context.l10n.aiErrRateLimited,
                  style: const TextStyle(
                      color: Color(0xFFFFB74D), fontSize: 14),
                ),
              ),
            ],
          )
        else if (message.isAiStreamInterrupted)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.warning_amber_rounded,
                  color: Color(0xFFFF6B6B), size: 16),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  context.l10n.aiErrStreamInterrupted,
                  style: const TextStyle(
                      color: Color(0xFFFF6B6B), fontSize: 14),
                ),
              ),
            ],
          )
        else if (message.isAiUnavailable)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.warning_amber_rounded,
                  color: Color(0xFFFF6B6B), size: 16),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  context.l10n.aiErrUnavailable,
                  style: const TextStyle(
                      color: Color(0xFFFF6B6B), fontSize: 14),
                ),
              ),
            ],
          )
        else if (message.isAiError)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.warning_amber_rounded,
                  color: Color(0xFFFF6B6B), size: 16),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  context.l10n.aiError,
                  style: const TextStyle(
                      color: Color(0xFFFF6B6B), fontSize: 14),
                ),
              ),
            ],
          )
        else if (message.isAiMessage && !message.isStreaming)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              FinalizedAiBubble(
                content: message.content,
                sources: message.sources,
                conversationId: message.conversationId,
              ),
              if (message.trace != null)
                TracePanel(trace: message.trace!),
            ],
          )
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
                    : Colors.white.withValues(alpha: 0.35),
              ),
            ),
            if (message.isEdited && !message.recalled) ...[
              const SizedBox(width: 4),
              Text(
                context.l10n.messageEdited,
                style: TextStyle(
                  fontSize: 9.5,
                  fontStyle: FontStyle.italic,
                  color: isSentByMe
                      ? Colors.white.withValues(alpha: 0.65)
                      : Colors.white.withValues(alpha: 0.35),
                ),
              ),
            ],
            // Per-user read tick only in DMs (parity with web:
            // groups use a tap-to-view read-by details modal, so
            // a single "other user" tick is meaningless there).
            if (isSentByMe && !message.recalled && !isGroup) ...[
              const SizedBox(width: 4),
              ReadTick(message: message, otherUserId: otherUserId),
            ],
          ],
        ),
      ],
    );
  }
}
