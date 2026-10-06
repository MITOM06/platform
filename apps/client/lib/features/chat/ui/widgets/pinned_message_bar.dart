import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_state.dart';
import 'pinned_preview_text.dart';

/// Displays the latest pinned message at the top of ChatScreen.
class PinnedMessageBar extends StatelessWidget {
  final PinnedMessageModel pinned;
  final VoidCallback onTap;

  /// Unpin action; null hides the close button (no permission to unpin).
  final VoidCallback? onDismiss;

  const PinnedMessageBar({
    super.key,
    required this.pinned,
    required this.onTap,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.accent(context).withValues(alpha: 0.08),
          border: Border(
            left: BorderSide(color: AppTheme.accent(context), width: 3),
          ),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          children: [
            Icon(Icons.push_pin_rounded, size: 14, color: AppTheme.accent(context)),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    context.l10n.pinnedMessageTitle,
                    style: TextStyle(
                      fontSize: 10,
                      color: AppTheme.accent(context),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    pinnedPreviewText(context, pinned),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            if (onDismiss != null)
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 16),
                tooltip: context.l10n.unpinMessage,
                onPressed: onDismiss,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              ),
          ],
        ),
      ),
    );
  }
}
