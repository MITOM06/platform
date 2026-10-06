import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:super_clipboard/super_clipboard.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/media_url.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import '../../domain/message_selection_provider.dart';
import 'forward_dialog.dart';
import 'group_read_details_modal.dart';
import 'media_actions.dart';

const List<String> kQuickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

/// A modal sheet displaying floating quick reactions (Messenger style) at the
/// top, followed by message context actions. Opaque surface + hairline border
/// per the Warm Grey & Burgundy direction (no glass, no elevation shadow).
class FloatingReactionSheet extends ConsumerWidget {
  final MessageModel message;
  final bool isSentByMe;

  /// Context + ref of the bubble that opened the sheet. Actions that continue
  /// AFTER the sheet is popped (forward picker, read details) must use these —
  /// the sheet's own context/ref are disposed by then, which made "Forward"
  /// silently do nothing.
  final BuildContext hostContext;
  final WidgetRef hostRef;

  const FloatingReactionSheet({
    super.key,
    required this.message,
    required this.isSentByMe,
    required this.hostContext,
    required this.hostRef,
  });

  /// Downloads the image bytes from [content] and writes them to the OS
  /// clipboard as a real image (PNG/JPEG) via super_clipboard. Falls back
  /// silently if the platform has no system clipboard image support.
  Future<void> _copyImageToClipboard(String content) async {
    final clipboard = SystemClipboard.instance;
    if (clipboard == null) return; // platform without clipboard write support
    final abs = absoluteMediaUrl(firstImageUrl(content));
    final resp = await Dio().get<List<int>>(
      abs,
      options: Options(responseType: ResponseType.bytes),
    );
    final bytes = Uint8List.fromList(resp.data ?? const []);
    if (bytes.isEmpty) return;
    final contentType = resp.headers.value('content-type')?.toLowerCase() ?? '';
    final isPng =
        contentType.contains('png') || abs.toLowerCase().endsWith('.png');
    final item = DataWriterItem();
    if (isPng) {
      item.add(Formats.png(bytes));
    } else {
      item.add(Formats.jpeg(bytes));
    }
    await clipboard.write([item]);
  }

  /// chat-service refuses to forward system, call-log and meeting-summary
  /// messages (400 MESSAGE_TYPE_NOT_ALLOWED) — don't offer it.
  static bool _canForward(MessageModel m) =>
      !m.recalled && !m.isSystem && !m.isCallLog && !m.isMeetingSummary;

  static void show(BuildContext context, WidgetRef ref, MessageModel message,
      bool isSentByMe) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.55),
      isScrollControlled: true,
      builder: (ctx) => FloatingReactionSheet(
        message: message,
        isSentByMe: isSentByMe,
        hostContext: context,
        hostRef: ref,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final notifier =
        ref.read(chatNotifierProvider(message.conversationId).notifier);
    final conv = ref.watch(conversationProvider(message.conversationId));
    final isGroupChat = conv?.isGroup ?? false;
    final me = ref.watch(authNotifierProvider.select((s) {
      final v = s.valueOrNull;
      return v is AuthAuthenticated ? v.user.id : '';
    }));
    // Pins are admin-only in groups (server: 403 GROUP_ADMIN_REQUIRED); both
    // people may pin in a direct chat. System / call messages are never pinned.
    final canPin = (conv?.canManage(me) ?? !isGroupChat) &&
        !message.isCallLog &&
        !message.isSystem;
    // Copy only what reads as text (or a single image). Voice, files, stickers
    // and collages store upload URLs / JSON that must never reach the
    // clipboard as raw text.
    final canCopy = message.type == 'text' ||
        message.isAiMessage ||
        (message.isImage && !message.isMultiImage);
    // Read the *current* pinned set so the Pin/Unpin label stays in sync
    // after a STOMP update (spec: unpin toggle freshness).
    final chatState =
        ref.watch(chatNotifierProvider(message.conversationId)).valueOrNull;
    final isPinned =
        chatState?.pinnedMessages.any((p) => p.id == message.id) ?? false;

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppTheme.radiusSheet)),
        border: Border(
          top: BorderSide(color: AppTheme.hairline(context), width: 1),
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
                color: AppTheme.hairline(context),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            const SizedBox(height: 20),

            // Messenger-style floating reactions row
            Container(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
              decoration: BoxDecoration(
                color: Theme.of(context).scaffoldBackgroundColor,
                borderRadius: BorderRadius.circular(32),
                border: Border.all(
                  color: AppTheme.hairline(context),
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: kQuickReactions.map((emoji) {
                  final hasReacted =
                      message.reactions.any((r) => r.emoji == emoji);
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
                            ? AppTheme.accent(context).withValues(alpha: 0.15)
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
            Divider(height: 1, color: AppTheme.hairline(context)),

            // Actions list — scrollable so it never overflows on small
            // screens / when the keyboard is up (D-1.1 fix).
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ListTile(
                      leading: Icon(Icons.reply_rounded,
                          color: AppTheme.mutedText(context)),
                      title: Text(l10n.actionReply),
                      onTap: () {
                        notifier.startReply(message);
                        context.pop();
                      },
                    ),
                    if (canCopy)
                      ListTile(
                        leading: Icon(Icons.copy_rounded,
                            color: AppTheme.mutedText(context)),
                        title: Text(l10n.actionCopy),
                        onTap: () async {
                          final messenger = ScaffoldMessenger.of(context);
                          final copiedMsg = context.l10n.copiedToClipboard;
                          context.pop();
                          // Single image → copy the actual image bytes into
                          // the OS clipboard; text keeps copy-as-text.
                          if (message.isImage) {
                            await _copyImageToClipboard(message.content);
                          } else {
                            await Clipboard.setData(
                                ClipboardData(text: message.content));
                          }
                          messenger.showSnackBar(
                            SnackBar(content: Text(copiedMsg)),
                          );
                        },
                      ),
                    if (message.isImage || message.isVideo)
                      ListTile(
                        leading: Icon(Icons.download_rounded,
                            color: AppTheme.mutedText(context)),
                        title: Text(l10n.downloadAction),
                        onTap: () {
                          context.pop();
                          downloadMedia(message.isVideo
                              ? message.content
                              : firstImageUrl(message.content));
                        },
                      ),
                    // Text only, matching web's `message.type === 'text'` gate. The old
                    // `!isMedia && !isFile` check let "Edit" through for voice and sticker
                    // messages (isMedia covers image+video only): the composer then opened
                    // on the message's raw `/api/uploads/<id>.m4a` URL, and saving replaced
                    // the audio with whatever text was typed.
                    if (isSentByMe && message.type == 'text')
                      ListTile(
                        leading: Icon(Icons.edit_rounded,
                            color: AppTheme.accent(context)),
                        title: Text(l10n.actionEdit,
                            style: TextStyle(color: AppTheme.accent(context))),
                        onTap: () {
                          notifier.startEditing(message);
                          context.pop();
                        },
                      ),
                    if (isSentByMe)
                      ListTile(
                        leading: const Icon(Icons.undo_rounded,
                            color: Colors.orangeAccent),
                        title: Text(l10n.actionRecall,
                            style: const TextStyle(color: Colors.orangeAccent)),
                        onTap: () {
                          notifier.recallMessage(message.id);
                          context.pop();
                        },
                      ),
                    if (isSentByMe && isGroupChat)
                      ListTile(
                        leading: Icon(Icons.done_all_rounded,
                            color: AppTheme.accent(context)),
                        title: Text(l10n.readDetails,
                            style: TextStyle(color: AppTheme.accent(context))),
                        onTap: () {
                          context.pop();
                          if (hostContext.mounted) {
                            showGroupReadDetailsModal(hostContext, message);
                          }
                        },
                      ),
                    if (canPin || isPinned)
                      ListTile(
                        leading: Icon(
                          // No rounded outline pin exists, so the unpinned state
                          // keeps the outlined variant to stay distinguishable.
                          isPinned
                              ? Icons.push_pin_rounded
                              : Icons.push_pin_outlined,
                          color: AppTheme.accent(context),
                        ),
                        title: Text(
                          isPinned ? l10n.unpinMessage : l10n.pinMessage,
                          style: TextStyle(color: AppTheme.accent(context)),
                        ),
                        onTap: () {
                          if (isPinned) {
                            notifier.unpinMessage(message.id);
                          } else {
                            notifier.pinMessage(message);
                          }
                          context.pop();
                        },
                      ),
                    ListTile(
                      leading: Icon(Icons.checklist_rounded,
                          color: AppTheme.mutedText(context)),
                      title: Text(l10n.selectMessages),
                      onTap: () {
                        context.pop();
                        final notifier = ref.read(
                            messageSelectionProvider(message.conversationId)
                                .notifier);
                        notifier.enter();
                        notifier.toggle(message.id, message.type);
                      },
                    ),
                    if (_canForward(message))
                    ListTile(
                      leading: Icon(Icons.forward_to_inbox_rounded,
                          color: AppTheme.mutedText(context)),
                      title: Text(l10n.forwardMessage),
                      onTap: () {
                        context.pop();
                        if (hostContext.mounted) {
                          showForwardDialog(hostContext, hostRef, message,
                              message.conversationId);
                        }
                      },
                    ),
                    ListTile(
                      leading: Icon(Icons.delete_outline_rounded,
                          color: Theme.of(context).colorScheme.error),
                      title: Text(l10n.actionDeleteForMe,
                          style: TextStyle(color: Theme.of(context).colorScheme.error)),
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
    );
  }
}
