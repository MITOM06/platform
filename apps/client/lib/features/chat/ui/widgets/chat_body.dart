import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/utils/app_error.dart';
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
    // Watch only the composer-relevant slices (editing / replying). Typing
    // events do not touch these, so the composer below does not rebuild when
    // someone starts/stops typing.
    final editingMessage = ref.watch(chatNotifierProvider(conversationId)
        .select((s) => s.valueOrNull?.editingMessage));
    final replyingTo = ref.watch(chatNotifierProvider(conversationId)
        .select((s) => s.valueOrNull?.replyingTo));

    final theme = Theme.of(context);
    final bool isDark = theme.brightness == Brightness.dark;
    final Color emojiBg =
        isDark ? AppTheme.darkBackground : theme.scaffoldBackgroundColor;
    final Color emojiSurface = isDark ? AppTheme.darkSurface : theme.cardColor;

    return Column(
      children: [
        Expanded(
          child: Column(
            children: [
              // Message-list section (pinned bar + list) watches only its own
              // slices — never typingUserIds — so a typing event no longer
              // rebuilds the whole message list.
              Expanded(
                child: _ChatMessageListSection(
                  conversationId: conversationId,
                  currentUserId: currentUserId,
                  isGroup: isGroup,
                  otherUserId: otherUserId,
                  scrollController: scrollController,
                  keyFor: keyFor,
                  onJump: onJump,
                ),
              ),
              // Personal assistant (Bot Factory) replies are synchronous with
              // no STOMP typing event — synthesise one: external-bot DM whose
              // newest message is the member's own. Clears when the bot's
              // broadcast becomes the newest message.
              _TypingIndicatorSection(
                conversationId: conversationId,
                currentUserId: currentUserId,
                otherUserId: otherUserId,
              ),
            ],
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

/// Pinned bar + message list. Watches only the message-list slices of the chat
/// state (messages / isLoadingMore / pinnedMessages and the async status) — it
/// deliberately does NOT watch typingUserIds, so a typing event never rebuilds
/// the (potentially long) message list.
class _ChatMessageListSection extends ConsumerWidget {
  final String conversationId;
  final String currentUserId;
  final bool isGroup;
  final String? otherUserId;
  final ScrollController scrollController;
  final GlobalKey Function(String messageId) keyFor;
  final void Function(String messageId) onJump;

  const _ChatMessageListSection({
    required this.conversationId,
    required this.currentUserId,
    required this.isGroup,
    required this.otherUserId,
    required this.scrollController,
    required this.keyFor,
    required this.onJump,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = chatNotifierProvider(conversationId);

    // Loading: only true on the very first load (before any data).
    final isLoading = ref.watch(provider.select((s) => s.isLoading && !s.hasValue));
    if (isLoading) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
        ),
      );
    }

    final error = ref.watch(provider.select((s) => s.hasValue ? null : s.error));
    if (error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 40, color: Colors.redAccent),
            const SizedBox(height: 12),
            Text(friendlyError(error),
                style: const TextStyle(color: Colors.white60)),
          ],
        ),
      );
    }

    // Watch only the list-relevant slices so typing changes don't rebuild here.
    final messages =
        ref.watch(provider.select((s) => s.valueOrNull?.messages));
    if (messages == null) return const SizedBox.shrink();
    final hasMore =
        ref.watch(provider.select((s) => s.valueOrNull?.hasMore ?? false));
    final isLoadingMore =
        ref.watch(provider.select((s) => s.valueOrNull?.isLoadingMore ?? false));
    final pinnedMessages =
        ref.watch(provider.select((s) => s.valueOrNull?.pinnedMessages)) ??
            const [];

    // Reconstruct the minimal ChatState the (other-agent-owned) ChatMessageList
    // reads (messages + isLoadingMore). Its signature is unchanged.
    final listState = ChatState(
      messages: messages,
      hasMore: hasMore,
      isLoadingMore: isLoadingMore,
    );

    return Column(
      children: [
        if (pinnedMessages.isNotEmpty)
          PinnedMessageBar(
            pinned: pinnedMessages.first,
            onTap: () => onJump(pinnedMessages.first.id),
            onDismiss: () => ref
                .read(chatNotifierProvider(conversationId).notifier)
                .unpinMessage(pinnedMessages.first.id),
          ),
        Expanded(
          child: ChatMessageList(
            chatState: listState,
            currentUserId: currentUserId,
            isGroup: isGroup,
            otherUserId: otherUserId,
            scrollController: scrollController,
            keyFor: keyFor,
          ),
        ),
      ],
    );
  }
}

/// Typing indicator. Watches ONLY typingUserIds (plus the newest-message sender
/// for the synthetic external-bot indicator) so it is the only thing that
/// rebuilds when a typing event arrives.
class _TypingIndicatorSection extends ConsumerWidget {
  final String conversationId;
  final String currentUserId;
  final String? otherUserId;

  const _TypingIndicatorSection({
    required this.conversationId,
    required this.currentUserId,
    required this.otherUserId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = chatNotifierProvider(conversationId);
    final typingUserIds =
        ref.watch(provider.select((s) => s.valueOrNull?.typingUserIds)) ??
            const <String>{};
    final newestSenderId = ref.watch(provider.select((s) {
      final msgs = s.valueOrNull?.messages;
      return (msgs == null || msgs.isEmpty) ? null : msgs.first.senderId;
    }));

    final visible = (typingUserIds.isNotEmpty &&
            !typingUserIds.contains(currentUserId)) ||
        ((otherUserId?.startsWith('extbot:') ?? false) &&
            newestSenderId == currentUserId);

    return ChatTypingIndicator(visible: visible);
  }
}
