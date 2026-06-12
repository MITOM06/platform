import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'forward_dialog.dart';
import 'group_read_details_modal.dart';

const List<String> kQuickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

/// A premium, glassmorphic modal sheet displaying floating quick reactions
/// (Messenger style) at the top, followed by message context actions.
class FloatingReactionSheet extends ConsumerWidget {
  final MessageModel message;
  final bool isSentByMe;

  const FloatingReactionSheet({
    super.key,
    required this.message,
    required this.isSentByMe,
  });

  static void show(BuildContext context, WidgetRef ref, MessageModel message, bool isSentByMe) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.55),
      isScrollControlled: true,
      builder: (ctx) => FloatingReactionSheet(
        message: message,
        isSentByMe: isSentByMe,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final notifier = ref.read(chatNotifierProvider(message.conversationId).notifier);
    final convs = ref.watch(conversationsNotifierProvider).valueOrNull;
    final isGroupChat =
        convs?.any((c) => c.id == message.conversationId && c.isGroup) ?? false;

    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.darkSurface.withValues(alpha: 0.75),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.08),
            width: 1,
          ),
        ),
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Pull bar indicator
              Container(
                width: 40,
                height: 4.5,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              const SizedBox(height: 20),
              
              // Messenger-style floating reactions row
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(32),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.05),
                    width: 1,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: kQuickReactions.map((emoji) {
                    final hasReacted = message.reactions.any((r) => r.emoji == emoji);
                    return GestureDetector(
                      onTap: () {
                        notifier.toggleReaction(message.id, emoji);
                        context.pop();
                      },
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: hasReacted
                              ? AppTheme.ponCyan.withValues(alpha: 0.15)
                              : Colors.transparent,
                        ),
                        child: Text(
                          emoji,
                          style: const TextStyle(fontSize: 28),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 16),
              const Divider(height: 1, color: Colors.white10),

              // Actions list — scrollable so it never overflows on small
              // screens / when the keyboard is up (D-1.1 fix).
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ListTile(
                        leading: const Icon(Icons.reply_rounded, color: Colors.white70),
                        title: Text(l10n.actionReply, style: const TextStyle(color: Colors.white)),
                        onTap: () {
                          notifier.startReply(message);
                          context.pop();
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.copy_rounded, color: Colors.white70),
                        title: Text(l10n.actionCopy, style: const TextStyle(color: Colors.white)),
                        onTap: () {
                          final text = message.isFile ? message.fileUrl : message.content;
                          Clipboard.setData(ClipboardData(text: text));
                          context.pop();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(context.l10n.copiedToClipboard)),
                          );
                        },
                      ),
                      if (isSentByMe && !message.isMedia && !message.isFile)
                        ListTile(
                          leading: const Icon(Icons.edit_rounded, color: AppTheme.ponCyan),
                          title: Text(l10n.actionEdit, style: const TextStyle(color: AppTheme.ponCyan)),
                          onTap: () {
                            notifier.startEditing(message);
                            context.pop();
                          },
                        ),
                      if (isSentByMe)
                        ListTile(
                          leading: const Icon(Icons.undo_rounded, color: Colors.orangeAccent),
                          title: Text(l10n.actionRecall, style: const TextStyle(color: Colors.orangeAccent)),
                          onTap: () {
                            notifier.recallMessage(message.id);
                            context.pop();
                          },
                        ),
                      if (isSentByMe && isGroupChat)
                        ListTile(
                          leading: const Icon(Icons.done_all_rounded, color: AppTheme.ponCyan),
                          title: Text(l10n.readDetails,
                              style: const TextStyle(color: AppTheme.ponCyan)),
                          onTap: () {
                            context.pop();
                            showGroupReadDetailsModal(context, message);
                          },
                        ),
                      ListTile(
                        leading: const Icon(Icons.push_pin_outlined, color: AppTheme.ponCyan),
                        title: Text(l10n.pinMessage, style: const TextStyle(color: AppTheme.ponCyan)),
                        onTap: () {
                          notifier.pinMessage(message);
                          context.pop();
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.forward_to_inbox_outlined, color: Colors.white70),
                        title: Text(l10n.forwardMessage, style: const TextStyle(color: Colors.white)),
                        onTap: () {
                          context.pop();
                          showForwardDialog(context, ref, message, message.conversationId);
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                        title: Text(l10n.actionDeleteForMe, style: const TextStyle(color: Colors.redAccent)),
                        onTap: () {
                          notifier.deleteForMe(message.id);
                          context.pop();
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
