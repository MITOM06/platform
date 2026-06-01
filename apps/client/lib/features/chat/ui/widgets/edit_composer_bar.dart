import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_state.dart';

class EditComposerBar extends StatelessWidget {
  final MessageModel preview;
  final VoidCallback onCancel;

  const EditComposerBar({super.key, required this.preview, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppTheme.darkSurface.withValues(alpha: 0.6),
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          const Icon(Icons.edit_rounded, color: AppTheme.ponPeach, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  context.l10n.actionEdit,
                  style: const TextStyle(
                    color: AppTheme.ponPeach,
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
