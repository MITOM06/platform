import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_state.dart';
import 'message_bubble.dart';

/// Reverse-scrolling message list with day dividers and a "load older" spinner.
/// Extracted from chat_screen.dart (clean-code file limit). The scroll
/// controller and per-message key resolver are owned by the screen and passed
/// in so behaviour (auto-scroll, scroll-to-message) is unchanged.
class ChatMessageList extends StatelessWidget {
  final ChatState chatState;
  final String currentUserId;
  final bool isGroup;
  final String? otherUserId;
  final ScrollController scrollController;
  final GlobalKey Function(String messageId) keyFor;

  const ChatMessageList({
    super.key,
    required this.chatState,
    required this.currentUserId,
    required this.isGroup,
    required this.otherUserId,
    required this.scrollController,
    required this.keyFor,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: scrollController,
      reverse: true,
      physics: const BouncingScrollPhysics(),
      itemCount:
          chatState.messages.length + (chatState.isLoadingMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (chatState.isLoadingMore && index == chatState.messages.length) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor:
                      AlwaysStoppedAnimation<Color>(AppTheme.ponCyan),
                ),
              ),
            ),
          );
        }
        final msg = chatState.messages[index];
        // [CHATDBG] TEMP diagnostic — remove after root-causing message-side bug.
        assert(() {
          if (index == 0) {
            debugPrint('[CHATDBG] newest msg.senderId="${msg.senderId}" '
                'currentUserId="$currentUserId" '
                'isSentByMe=${msg.senderId == currentUserId} '
                'isPending=${msg.isPending} content="${msg.content}"');
          }
          return true;
        }());
        bool showDate = index == chatState.messages.length - 1;
        if (!showDate) {
          final prevMsg = chatState.messages[index + 1];
          final cur = msg.createdAt.toLocal();
          final prev = prevMsg.createdAt.toLocal();
          showDate = cur.day != prev.day ||
              cur.month != prev.month ||
              cur.year != prev.year;
        }

        Widget child = MessageBubble(
          key: keyFor(msg.id),
          message: msg,
          isSentByMe: msg.senderId == currentUserId,
          otherUserId: otherUserId,
          showSenderName: isGroup,
          highlighted: chatState.highlightMessageId == msg.id,
          isGroup: isGroup,
        );

        if (showDate) {
          child = Column(
            children: [
              _DateDivider(date: msg.createdAt.toLocal()),
              child,
            ],
          );
        }
        return child;
      },
    );
  }
}

/// Centered "Today / Yesterday / full date" chip between days of messages.
class _DateDivider extends StatelessWidget {
  final DateTime date;
  const _DateDivider({required this.date});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final String dateText;
    if (date.year == now.year &&
        date.month == now.month &&
        date.day == now.day) {
      dateText = context.l10n.dateToday;
    } else {
      final yest = now.subtract(const Duration(days: 1));
      if (date.year == yest.year &&
          date.month == yest.month &&
          date.day == yest.day) {
        dateText = context.l10n.dateYesterday;
      } else {
        dateText = DateFormat.yMMMMd(
                Localizations.localeOf(context).languageCode)
            .format(date);
      }
    }
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: isDark
              ? AppTheme.darkSurface.withValues(alpha: 0.8)
              : Colors.black.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isDark
                  ? AppTheme.darkBorder.withValues(alpha: 0.5)
                  : Colors.black.withValues(alpha: 0.08)),
        ),
        child: Text(
          dateText,
          style: TextStyle(
              color: isDark ? Colors.white70 : Colors.black54,
              fontSize: 11,
              fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}
