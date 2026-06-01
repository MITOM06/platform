import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'file_content.dart';
import 'image_content.dart';
import 'message_bubble_parts.dart';
import 'text_content.dart';

const List<String> kQuickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

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
      return SystemMessage(content: _systemText(context, message.content));
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
                SenderName(userId: message.senderId),
              GestureDetector(
                onLongPress:
                    message.recalled ? null : () => _showActions(context, ref),
                child: Container(
                  margin: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 3),
                  constraints: BoxConstraints(
                    maxWidth:
                        MediaQuery.of(context).size.width * 0.72,
                  ),
                  decoration: BoxDecoration(
                    gradient: isSentByMe && !message.recalled
                        ? const LinearGradient(
                            colors: [AppTheme.ponCyan, AppTheme.ponPeach],
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
                  padding: message.isMedia && !message.recalled
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
                      else if (message.isImage)
                        ImageContent(url: message.content)
                      else if (message.isVideo)
                        VideoContent(url: message.content)
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

  String _systemText(BuildContext context, String key) {
    switch (key) {
      case 'system.group.created':
        return context.l10n.createGroup;
      case 'system.members.added':
        return context.l10n.addMembers;
      case 'system.member.left':
        return context.l10n.leaveGroup;
      case 'system.member.removed':
        return context.l10n.removeMember;
      default:
        return key;
    }
  }

  void _showActions(BuildContext context, WidgetRef ref) {
    final notifier =
        ref.read(chatNotifierProvider(message.conversationId).notifier);
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.darkSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Padding(
              padding:
                  const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  for (final emoji in kQuickReactions)
                    InkWell(
                      borderRadius: BorderRadius.circular(24),
                      onTap: () {
                        notifier.toggleReaction(message.id, emoji);
                        Navigator.pop(sheetCtx);
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(6),
                        child: Text(emoji,
                            style: const TextStyle(fontSize: 26)),
                      ),
                    ),
                ],
              ),
            ),
            const Divider(height: 1, color: Colors.white12),
            ListTile(
              leading: const Icon(Icons.reply_rounded,
                  color: Colors.white70),
              title: Text(sheetCtx.l10n.actionReply,
                  style: const TextStyle(color: Colors.white)),
              onTap: () {
                notifier.startReply(message);
                Navigator.pop(sheetCtx);
              },
            ),
            ListTile(
              leading: const Icon(Icons.copy_rounded, color: Colors.white70),
              title: Text(sheetCtx.l10n.actionCopy,
                  style: const TextStyle(color: Colors.white)),
              onTap: () {
                final text =
                    message.isFile ? message.fileUrl : message.content;
                Clipboard.setData(ClipboardData(text: text));
                Navigator.pop(sheetCtx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                      content: Text(context.l10n.copiedToClipboard)),
                );
              },
            ),
            if (isSentByMe && !message.isMedia && !message.isFile)
              ListTile(
                leading: const Icon(Icons.edit_rounded,
                    color: AppTheme.ponCyan),
                title: Text(sheetCtx.l10n.actionEdit,
                    style: const TextStyle(color: AppTheme.ponCyan)),
                onTap: () {
                  notifier.startEditing(message);
                  Navigator.pop(sheetCtx);
                },
              ),
            if (isSentByMe)
              ListTile(
                leading: const Icon(Icons.undo_rounded,
                    color: Colors.orangeAccent),
                title: Text(sheetCtx.l10n.actionRecall,
                    style:
                        const TextStyle(color: Colors.orangeAccent)),
                onTap: () {
                  notifier.recallMessage(message.id);
                  Navigator.pop(sheetCtx);
                },
              ),
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded,
                  color: Colors.redAccent),
              title: Text(sheetCtx.l10n.actionDeleteForMe,
                  style: const TextStyle(color: Colors.redAccent)),
              onTap: () {
                notifier.deleteForMe(message.id);
                Navigator.pop(sheetCtx);
              },
            ),
          ],
        ),
      ),
    );
  }
}

