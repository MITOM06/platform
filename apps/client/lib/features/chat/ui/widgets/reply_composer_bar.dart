import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_state.dart';

class ReplyComposerBar extends StatelessWidget {
  final MessageModel preview;
  final VoidCallback onCancel;

  const ReplyComposerBar({super.key, required this.preview, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppTheme.darkSurface.withValues(alpha: 0.6),
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Container(width: 3, height: 36, color: AppTheme.ponCyan),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  context.l10n.actionReply,
                  style: const TextStyle(
                    color: AppTheme.ponCyan,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  preview.content,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.6),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close_rounded, color: Colors.white54, size: 20),
            onPressed: onCancel,
          ),
        ],
      ),
    );
  }
}
