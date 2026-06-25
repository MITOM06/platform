import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'blocked_composer_notice.dart';
import 'chat_input_bar.dart';
import 'chat_message_list.dart';
import 'chat_typing_indicator.dart';
import 'edit_composer_bar.dart';
import 'emoji_sticker_panel.dart';
import 'mention_list.dart';
import 'pinned_message_bar.dart';
import 'reply_composer_bar.dart';
import 'stranger_request_banner.dart';

/// The chat column: pinned bar + message list + typing indicator on top, and
/// the composer area (edit/reply/mention/input/emoji) below — switching to a
/// blocked notice or stranger-request banner when applicable.
///
/// Extracted from chat_screen.dart (clean-code file limit). All interaction is
/// driven through the callbacks supplied by the screen so behaviour is
/// unchanged; this widget only owns layout.
class ChatBody extends ConsumerWidget {
  final String conversationId;
  final AsyncValue<ChatState> chatAsync;
  final String currentUserId;
  final bool isGroup;
  final String? otherUserId;
  final List<String> participantIds;
  final bool isBlocked;
  final bool isStrangerRequest;

  final ScrollController scrollController;
  final GlobalKey Function(String messageId) keyFor;
  final TextEditingController textController;

  final bool showEmoji;
  final String? mentionQuery;

  final void Function(String messageId) onJump;
  final VoidCallback onSend;
  final VoidCallback onAttach;
  final VoidCallback onEmojiToggle;
  final ValueChanged<String> onComposerChanged;
  final VoidCallback onQuickReaction;
  final Future<void> Function(String path) onVoiceSend;
  final ValueChanged<String> onEmojiSelected;
  final ValueChanged<String> onStickerSelected;
  final ValueChanged<String> onMentionSelected;
  final VoidCallback onCancelEditing;
  final Future<void> Function() onAcceptStranger;
  final Future<void> Function() onRejectStranger;

  const ChatBody({
    super.key,
    required this.conversationId,
    required this.chatAsync,
    required this.currentUserId,
    required this.isGroup,
    required this.otherUserId,
    required this.participantIds,
    required this.isBlocked,
    required this.isStrangerRequest,
    required this.scrollController,
    required this.keyFor,
    required this.textController,
    required this.showEmoji,
    required this.mentionQuery,
    required this.onJump,
    required this.onSend,
    required this.onAttach,
    required this.onEmojiToggle,
    required this.onComposerChanged,
    required this.onQuickReaction,
    required this.onVoiceSend,
    required this.onEmojiSelected,
    required this.onStickerSelected,
    required this.onMentionSelected,
    required this.onCancelEditing,
    required this.onAcceptStranger,
    required this.onRejectStranger,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final editingMessage = chatAsync.valueOrNull?.editingMessage;
    final replyingTo = chatAsync.valueOrNull?.replyingTo;

    final theme = Theme.of(context);
    final bool isDark = theme.brightness == Brightness.dark;
    final Color emojiBg =
        isDark ? AppTheme.darkBackground : theme.scaffoldBackgroundColor;
    final Color emojiSurface = isDark ? AppTheme.darkSurface : theme.cardColor;

    return Column(
      children: [
        Expanded(
          child: chatAsync.when(
            loading: () => const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
              ),
            ),
            error: (e, _) => Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.error_outline,
                      size: 40, color: Colors.redAccent),
                  const SizedBox(height: 12),
                  Text(context.l10n.errorWithMsg(e.toString()),
                      style: const TextStyle(color: Colors.white60)),
                ],
              ),
            ),
            data: (chatState) => Column(
              children: [
                if (chatState.pinnedMessages.isNotEmpty)
                  PinnedMessageBar(
                    pinned: chatState.pinnedMessages.first,
                    onTap: () => onJump(chatState.pinnedMessages.first.id),
                    onDismiss: () => ref
                        .read(chatNotifierProvider(conversationId).notifier)
                        .unpinMessage(chatState.pinnedMessages.first.id),
                  ),
                Expanded(
                  child: ChatMessageList(
                    chatState: chatState,
                    currentUserId: currentUserId,
                    isGroup: isGroup,
                    otherUserId: otherUserId,
                    scrollController: scrollController,
                    keyFor: keyFor,
                  ),
                ),
                // Personal assistant (Bot Factory) replies are synchronous with
                // no STOMP typing event — synthesise one: external-bot DM whose
                // newest message is the member's own. Clears when the bot's
                // broadcast becomes the newest message.
                ChatTypingIndicator(
                  visible: (chatState.typingUserIds.isNotEmpty &&
                          !chatState.typingUserIds.contains(currentUserId)) ||
                      ((otherUserId?.startsWith('extbot:') ?? false) &&
                          chatState.messages.isNotEmpty &&
                          chatState.messages.first.senderId == currentUserId),
                ),
              ],
            ),
          ),
        ),
        if (isBlocked)
          const BlockedComposerNotice()
        else if (isStrangerRequest)
          StrangerRequestBanner(
            onAccept: onAcceptStranger,
            onReject: onRejectStranger,
          )
        else ...[
          if (editingMessage != null)
            EditComposerBar(preview: editingMessage, onCancel: onCancelEditing)
          else if (replyingTo != null)
            ReplyComposerBar(
              preview: replyingTo,
              onCancel: () => ref
                  .read(chatNotifierProvider(conversationId).notifier)
                  .cancelReply(),
            ),
          if (isGroup && mentionQuery != null)
            MentionList(
              participantIds: participantIds,
              query: mentionQuery!,
              onSelected: onMentionSelected,
            ),
          ChatInputBar(
            controller: textController,
            onSend: onSend,
            onAttach: onAttach,
            emojiActive: showEmoji,
            onEmojiToggle: onEmojiToggle,
            onChanged: onComposerChanged,
            quickReactionEmoji:
                ref.watch(quickReactionProvider(conversationId)),
            onQuickReaction: onQuickReaction,
            onVoiceSend: onVoiceSend,
          ),
          if (showEmoji)
            EmojiStickerPanel(
              onEmojiSelected: onEmojiSelected,
              onStickerSelected: onStickerSelected,
              bgColor: emojiBg,
              surfaceColor: emojiSurface,
            ),
        ],
      ],
    );
  }
}
