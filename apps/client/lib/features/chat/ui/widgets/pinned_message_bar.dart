import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_state.dart';

/// Displays the latest pinned message at the top of ChatScreen.
class PinnedMessageBar extends StatelessWidget {
  final PinnedMessageModel pinned;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  const PinnedMessageBar({
    super.key,
    required this.pinned,
    required this.onTap,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.ponCyan.withValues(alpha: 0.08),
          border: const Border(
            left: BorderSide(color: AppTheme.ponCyan, width: 3),
          ),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          children: [
            const Icon(Icons.push_pin, size: 14, color: AppTheme.ponCyan),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Pinned message',
                    style: TextStyle(
                      fontSize: 10,
                      color: AppTheme.ponCyan,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    pinned.content,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 16),
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
