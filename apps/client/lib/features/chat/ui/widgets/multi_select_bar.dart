import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_provider.dart';
import '../../domain/message_models.dart';
import '../../domain/message_selection_provider.dart';
import 'forward_dialog.dart';

/// Bottom action bar shown in place of the composer while multi-select is
/// active. Mirrors the web `MultiSelectBar` — bulk forward (single only),
/// recall (own + recallable only), and delete-for-me over the current
/// selection. Reuses the existing per-message provider actions.
class MultiSelectBar extends ConsumerWidget {
  final String conversationId;
  final String currentUserId;

  const MultiSelectBar({
    super.key,
    required this.conversationId,
    required this.currentUserId,
  });

  List<MessageModel> _selected(WidgetRef ref) {
    final ids = ref.read(messageSelectionProvider(conversationId)).selectedIds;
    final msgs = ref
            .read(chatNotifierProvider(conversationId))
            .valueOrNull
            ?.messages ??
        const [];
    return msgs.where((m) => ids.contains(m.id)).toList();
  }

  Future<void> _forward(BuildContext context, WidgetRef ref) async {
    final selected = _selected(ref);
    if (selected.length != 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.multiForwardHint)),
      );
      return;
    }
    // Keep the bar mounted while the dialog is open (it owns `context`); clear
    // the selection only after the forward flow completes.
    await showForwardDialog(context, ref, selected.first, conversationId);
    ref.read(messageSelectionProvider(conversationId).notifier).exit();
  }

  Future<void> _recall(BuildContext context, WidgetRef ref) async {
    final own = _selected(ref)
        .where((m) => m.senderId == currentUserId && !m.recalled)
        .toList();
    if (own.isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    final label = context.l10n.multiRecalled(own.length);
    final notifier = ref.read(chatNotifierProvider(conversationId).notifier);
    ref.read(messageSelectionProvider(conversationId).notifier).exit();
    await Future.wait(own.map((m) => notifier.recallMessage(m.id)));
    messenger.showSnackBar(SnackBar(content: Text(label)));
  }

  Future<void> _delete(BuildContext context, WidgetRef ref) async {
    final selected = _selected(ref);
    if (selected.isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);
    final label = context.l10n.multiDeleted(selected.length);
    final notifier = ref.read(chatNotifierProvider(conversationId).notifier);
    ref.read(messageSelectionProvider(conversationId).notifier).exit();
    await Future.wait(selected.map((m) => notifier.deleteForMe(m.id)));
    messenger.showSnackBar(SnackBar(content: Text(label)));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final selection = ref.watch(messageSelectionProvider(conversationId));
    final count = selection.selectedIds.length;
    final empty = count == 0;

    // Every selected message is the current user's own and still recallable.
    final messages = ref
            .watch(chatNotifierProvider(conversationId)
                .select((s) => s.valueOrNull?.messages)) ??
        const [];
    final canRecall = !empty &&
        selection.selectedIds.every((id) {
          final m = messages.where((msg) => msg.id == id).firstOrNull;
          return m != null && m.senderId == currentUserId && !m.recalled;
        });

    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final borderColor = isDark
        ? AppTheme.darkBorder.withValues(alpha: 0.4)
        : Colors.black.withValues(alpha: 0.08);

    return Container(
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        border: Border(top: BorderSide(color: borderColor, width: 1)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 8, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      empty
                          ? l10n.multiSelectEmpty
                          : l10n.multiSelectCount(count),
                      style: TextStyle(
                        color: textColor,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () => ref
                        .read(messageSelectionProvider(conversationId).notifier)
                        .exit(),
                    icon: const Icon(Icons.close_rounded, size: 16),
                    label: Text(l10n.multiSelectCancel),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
              child: Row(
                children: [
                  Expanded(
                    child: _ActionButton(
                      icon: Icons.forward_to_inbox_outlined,
                      label: l10n.forwardMessage,
                      color: AppTheme.ponCyan,
                      onPressed:
                          empty ? null : () => _forward(context, ref),
                    ),
                  ),
                  if (canRecall) ...[
                    const SizedBox(width: 8),
                    Expanded(
                      child: _ActionButton(
                        icon: Icons.undo_rounded,
                        label: l10n.actionRecall,
                        color: Colors.orangeAccent,
                        onPressed: () => _recall(context, ref),
                      ),
                    ),
                  ],
                  const SizedBox(width: 8),
                  Expanded(
                    child: _ActionButton(
                      icon: Icons.delete_outline_rounded,
                      label: l10n.actionDeleteForMe,
                      color: Colors.redAccent,
                      onPressed: empty ? null : () => _delete(context, ref),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onPressed;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 16),
      label: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 12),
      ),
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(color: color.withValues(alpha: 0.4)),
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
