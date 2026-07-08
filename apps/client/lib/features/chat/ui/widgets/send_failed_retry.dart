import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/chat_provider.dart';

/// Tap-to-retry affordance shown under an outgoing message whose optimistic
/// STOMP send got no server echo within the send-watchdog window (see
/// ChatNotifier._startSendWatchdog). Tapping re-sends the message content.
class SendFailedRetry extends ConsumerWidget {
  final String conversationId;
  final String messageId;
  const SendFailedRetry({
    super.key,
    required this.conversationId,
    required this.messageId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(right: 16, top: 2, bottom: 2),
      child: GestureDetector(
        onTap: () => ref
            .read(chatNotifierProvider(conversationId).notifier)
            .retrySend(messageId),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 13, color: Color(0xFFFF6B6B)),
            const SizedBox(width: 4),
            Text(
              context.l10n.messageSendFailedRetry,
              style: const TextStyle(fontSize: 10.5, color: Color(0xFFFF6B6B)),
            ),
          ],
        ),
      ),
    );
  }
}
