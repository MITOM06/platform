import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
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
          error: (e, _) => Center(child: Text(l10n.errorWithMsg('$e'))),
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
  final targetConvId = await showDialog<String>(
    context: context,
    builder: (_) => ForwardDialog(
      message: message,
      sourceConversationId: conversationId,
    ),
  );
  if (targetConvId == null || !context.mounted) return;
  final notifier = ref.read(chatNotifierProvider(conversationId).notifier);
  final ok = await notifier.forwardMessage(message.id, targetConvId);
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok
          ? context.l10n.messageForwarded
          : context.l10n.forwardFailed),
    ));
  }
}
