import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/utils/app_error.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';

/// Dialog that lets the user pick a conversation to forward [message] into.
class ForwardDialog extends ConsumerWidget {
  final MessageModel message;
  final String sourceConversationId;

  const ForwardDialog({
    super.key,
    required this.message,
    required this.sourceConversationId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final convs = ref.watch(conversationsNotifierProvider);

    return AlertDialog(
      title: Text(l10n.forwardMessage),
      content: SizedBox(
        width: double.maxFinite,
        height: 320,
        child: convs.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text(friendlyError(e))),
          data: (list) {
            final targets =
                list.where((c) => c.id != sourceConversationId).toList();
            if (targets.isEmpty) {
              return Center(child: Text(l10n.noConversationsToForward));
            }
            return ListView.builder(
              itemCount: targets.length,
              itemBuilder: (ctx, i) => _ForwardTargetTile(conv: targets[i]),
            );
          },
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.actionCancel),
        ),
      ],
    );
  }
}

/// One forward-target row. Resolves the display name the same way
/// [ConversationTile] does so 1:1 chats show the peer's nickname / display name
/// instead of a raw participant ID, and AI chats show the assistant label.
class _ForwardTargetTile extends ConsumerWidget {
  final ConversationModel conv;

  const _ForwardTargetTile({required this.conv});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final isGroup = conv.isGroup;

    final currentUserId = ref.watch(
      authNotifierProvider.select((s) {
        final v = s.valueOrNull;
        return v is AuthAuthenticated ? v.user.id : '';
      }),
    );

    final others =
        conv.participants.where((p) => p != currentUserId).toList();
    final otherUserId = !isGroup && others.isNotEmpty ? others.first : '';
    final isAiBot = !isGroup && otherUserId == kAiBotUserId;

    final profileData = (otherUserId.isNotEmpty && !isAiBot)
        ? ref.watch(
            userProfileProvider(otherUserId).select((s) => s.valueOrNull),
          )
        : null;
    final nicknames = ref.watch(nicknamesProvider(conv.id));
    final dmNickname = (!isGroup && otherUserId.isNotEmpty)
        ? nicknames[otherUserId]
        : null;

    final displayName = isGroup
        ? (conv.name ?? l10n.conversationDefault)
        : (isAiBot
            ? l10n.aiAssistant
            : ((dmNickname != null && dmNickname.isNotEmpty)
                ? dmNickname
                : (profileData?.displayName ?? l10n.conversationDefault)));

    final letter = isAiBot
        ? 'AI'
        : (displayName.isNotEmpty ? displayName[0].toUpperCase() : '?');

    return ListTile(
      leading: CircleAvatar(child: Text(letter)),
      title: Text(displayName),
      onTap: () => Navigator.of(context).pop(conv.id),
    );
  }
}

/// Shows the forward dialog and forwards the message if a target is selected.
Future<void> showForwardDialog(
  BuildContext context,
  WidgetRef ref,
  MessageModel message,
  String conversationId,
) async {
  // Capture everything needed after the dialog up-front: [context] may be
  // gone (list rebuilt) by the time the forward request finishes.
  final notifier = ref.read(chatNotifierProvider(conversationId).notifier);
  final messenger = ScaffoldMessenger.of(context);
  final forwarded = context.l10n.messageForwarded;
  final targetConvId = await showDialog<String>(
    context: context,
    builder: (_) => ForwardDialog(
      message: message,
      sourceConversationId: conversationId,
    ),
  );
  if (targetConvId == null) return;
  final error = await notifier.forwardMessage(message.id, targetConvId);
  messenger.showSnackBar(SnackBar(content: Text(error ?? forwarded)));
}
