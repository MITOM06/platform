import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/chat_state.dart';
import 'message_preview_text.dart';

class ReplyComposerBar extends StatelessWidget {
  final MessageModel preview;
  final VoidCallback onCancel;

  const ReplyComposerBar({super.key, required this.preview, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Theme.of(context).colorScheme.surface,
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Container(width: 3, height: 36, color: AppTheme.ponAccent),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  context.l10n.actionReply,
                  style: const TextStyle(
                    color: AppTheme.ponAccent,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                // Sanitized like [ReplyQuote] inside the bubble: replying to a system
                // event, a file or an image otherwise printed the raw `system.*` code,
                // the JSON payload or the /api/uploads URL into the composer
                // (.claude/rules/no-raw-system-data-in-ui.md).
                Text(
                  messagePreviewFromContent(context, preview.content),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppTheme.mutedText(context),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.close_rounded, color: AppTheme.mutedText(context), size: 20),
            onPressed: onCancel,
          ),
        ],
      ),
    );
  }
}
