import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'pinned_preview_text.dart';

/// Info-panel section listing the pinned messages of a conversation
/// (mobile mirror of the web pinned-messages info section). Renders up to two
/// pinned messages, each with the sender name, a truncated preview, and an
/// unpin (X) affordance. Used by [GroupInfoScreen] and the conversation info
/// sidebar so group and DM views stay in sync (Task 53 gap-closing).
class PinnedMessagesSection extends ConsumerWidget {
  final String conversationId;
  final List<PinnedMessageModel> pinnedMessages;

  /// Whether to render the leading section header. The sidebar wraps the list
  /// in its own ExpansionTile, so it disables the inline header.
  final bool showHeader;

  const PinnedMessagesSection({
    super.key,
    required this.conversationId,
    required this.pinnedMessages,
    this.showHeader = true,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (pinnedMessages.isEmpty) return const SizedBox.shrink();

    // Spec: show up to 2 pinned messages (cap matches backend max).
    final visible = pinnedMessages.take(2).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showHeader)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.push_pin, size: 15, color: AppTheme.ponAccent),
                const SizedBox(width: 6),
                Text(
                  context.l10n.pinnedMessagesTitle,
                  style: TextStyle(
                    color: AppTheme.mutedText(context),
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        for (final pinned in visible)
          _PinnedRow(
            conversationId: conversationId,
            pinned: pinned,
          ),
      ],
    );
  }
}

class _PinnedRow extends ConsumerWidget {
  final String conversationId;
  final PinnedMessageModel pinned;

  const _PinnedRow({
    required this.conversationId,
    required this.pinned,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(userProfileProvider(pinned.senderId)).valueOrNull;
    final senderName = profile?.displayName ?? '…';
    final preview = pinnedPreviewText(context, pinned);

    return ListTile(
      dense: true,
      leading: const Icon(Icons.push_pin_outlined,
          size: 18, color: AppTheme.ponAccent),
      title: Text(
        senderName,
        style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600, fontSize: 13),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        preview,
        style: TextStyle(color: AppTheme.mutedText(context), fontSize: 12),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: IconButton(
        icon: Icon(Icons.close, size: 18, color: AppTheme.mutedText(context)),
        tooltip: context.l10n.unpinMessage,
        onPressed: () => ref
            .read(chatNotifierProvider(conversationId).notifier)
            .unpinMessage(pinned.id),
      ),
    );
  }
}
