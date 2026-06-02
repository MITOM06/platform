import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
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
          error: (e, _) => Center(child: Text('Error: $e')),
          data: (list) {
            final targets =
                list.where((c) => c.id != sourceConversationId).toList();
            if (targets.isEmpty) {
              return Center(child: Text(l10n.noConversationsToForward));
            }
            return ListView.builder(
              itemCount: targets.length,
              itemBuilder: (ctx, i) {
                final c = targets[i];
                final title = c.isGroup
                    ? (c.name ?? 'Group')
                    : (c.participants.length > 1
                        ? c.participants
                            .where((p) => p != c.createdBy)
                            .first
                        : c.participants.first);
                return ListTile(
                  leading: CircleAvatar(
                    child: Text(
                      (c.name ?? title).substring(0, 1).toUpperCase(),
                    ),
                  ),
                  title: Text(c.isGroup ? (c.name ?? 'Group') : title),
                  onTap: () => Navigator.of(context).pop(c.id),
                );
              },
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
