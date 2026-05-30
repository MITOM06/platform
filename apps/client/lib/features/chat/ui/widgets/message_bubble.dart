import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';

const List<String> kQuickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

class MessageBubble extends ConsumerWidget {
  final MessageModel message;
  final bool isSentByMe;
  final String? otherUserId;
  final bool showSenderName;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isSentByMe,
    this.otherUserId,
    this.showSenderName = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (message.isSystem) {
      return _SystemMessage(content: _systemText(context, message.content));
    }

    final locale = Localizations.localeOf(context).languageCode;
    final timeStr = DateFormat.Hm(locale).format(message.createdAt.toLocal());

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      builder: (context, animValue, child) {
        return Opacity(
          opacity: message.isPending ? 0.5 : animValue,
          child: Transform.translate(
            offset: Offset(0, 12 * (1.0 - animValue)),
            child: child,
          ),
        );
      },
      child: Align(
        alignment: isSentByMe ? Alignment.centerRight : Alignment.centerLeft,
        child: Column(
          crossAxisAlignment:
              isSentByMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (showSenderName && !isSentByMe) _SenderName(userId: message.senderId),
            GestureDetector(
              onLongPress: message.recalled
                  ? null
                  : () => _showActions(context, ref),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.of(context).size.width * 0.72,
                ),
                decoration: BoxDecoration(
                  gradient: isSentByMe && !message.recalled
                      ? const LinearGradient(
                          colors: [AppTheme.neonCyan, AppTheme.neonPurple],
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
                    bottomLeft: Radius.circular(isSentByMe ? 20 : 4),
                    bottomRight: Radius.circular(isSentByMe ? 4 : 20),
                  ),
                  border: isSentByMe && !message.recalled
                      ? null
                      : Border.all(
                          color: AppTheme.darkBorder.withValues(alpha: 0.4),
                          width: 1,
                        ),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (message.replyPreview != null && !message.recalled)
                      _ReplyQuote(preview: message.replyPreview!),
                    if (message.recalled)
                      Text(
                        context.l10n.messageRecalled,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.55),
                          fontSize: 14,
                          fontStyle: FontStyle.italic,
                        ),
                      )
                    else
                      Text(
                        message.content,
                        style: TextStyle(
                          color: isSentByMe
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.9),
                          fontSize: 14.5,
                          height: 1.35,
                        ),
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
              _ReactionChips(message: message),
          ],
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
      color: isRead ? AppTheme.neonCyan : Colors.white.withValues(alpha: 0.4),
    );
  }

  /// System messages carry an i18n key (e.g. "system.group.created").
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
      builder: (sheetCtx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              // Quick reaction bar
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
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
                          child: Text(emoji, style: const TextStyle(fontSize: 26)),
                        ),
                      ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Colors.white12),
              ListTile(
                leading: const Icon(Icons.reply_rounded, color: Colors.white70),
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
                  Clipboard.setData(ClipboardData(text: message.content));
                  Navigator.pop(sheetCtx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(context.l10n.copiedToClipboard)),
                  );
                },
              ),
              if (isSentByMe)
                ListTile(
                  leading: const Icon(Icons.undo_rounded, color: Colors.orangeAccent),
                  title: Text(sheetCtx.l10n.actionRecall,
                      style: const TextStyle(color: Colors.orangeAccent)),
                  onTap: () {
                    notifier.recallMessage(message.id);
                    Navigator.pop(sheetCtx);
                  },
                ),
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                title: Text(sheetCtx.l10n.actionDeleteForMe,
                    style: const TextStyle(color: Colors.redAccent)),
                onTap: () {
                  notifier.deleteForMe(message.id);
                  Navigator.pop(sheetCtx);
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SenderName extends ConsumerWidget {
  final String userId;
  const _SenderName({required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider(userId)).valueOrNull;
    return Padding(
      padding: const EdgeInsets.only(left: 24, top: 4, bottom: 2),
      child: Text(
        profile?.displayName ?? '…',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: AppTheme.neonCyan.withValues(alpha: 0.8),
        ),
      ),
    );
  }
}

class _ReplyQuote extends StatelessWidget {
  final ReplyPreview preview;
  const _ReplyQuote({required this.preview});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(8),
        border: const Border(
          left: BorderSide(color: AppTheme.neonCyan, width: 3),
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

class _ReactionChips extends StatelessWidget {
  final MessageModel message;
  const _ReactionChips({required this.message});

  @override
  Widget build(BuildContext context) {
    // Aggregate emoji -> count.
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
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: AppTheme.darkSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppTheme.neonCyan.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
              child: Text(
                entry.value > 1 ? '${entry.key} ${entry.value}' : entry.key,
                style: const TextStyle(fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}

class _SystemMessage extends StatelessWidget {
  final String content;
  const _SystemMessage({required this.content});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 40),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          content,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11.5,
            color: Colors.white.withValues(alpha: 0.5),
          ),
        ),
      ),
    );
  }
}
