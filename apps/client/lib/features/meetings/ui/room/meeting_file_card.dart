import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../chat/ui/widgets/file_content.dart' show fileIcon, formatBytes;
import '../../../chat/ui/widgets/media_actions.dart' show downloadMedia;
import '../../domain/meeting_attachment.dart';

/// A file in a meeting chat line: icon, name, size; a tap downloads it.
/// The URL is never shown (web `FileCard`).
class MeetingFileCard extends StatelessWidget {
  const MeetingFileCard({
    super.key,
    required this.attachment,
    this.onTap,
    this.mine = false,
    this.border,
  });

  final MeetingAttachment attachment;

  /// My own line: tinted like my text bubble (web `bg-accent`).
  final bool mine;

  /// A failed line's red outline.
  final Color? border;

  /// Defaults to downloading through the media URL (with its token).
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final size = formatBytes(attachment.size);
    final muted = AppTheme.mutedText(context);
    final radius = BorderRadius.circular(AppTheme.radiusControl);
    final b = border;
    return ConstrainedBox(
      constraints:
          BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
      child: Material(
        color: mine
            ? AppTheme.accentTint(context)
            : AppTheme.mutedSurface(context),
        shape: RoundedRectangleBorder(
            borderRadius: radius,
            side: b == null ? BorderSide.none : BorderSide(color: b)),
        child: InkWell(
          borderRadius: radius,
          onTap: onTap ?? () => downloadMedia(attachment.url),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(fileIcon(attachment.name), size: 26),
              const SizedBox(width: 10),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(attachment.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color:
                                mine ? AppTheme.accentTintFg(context) : null)),
                    if (size.isNotEmpty)
                      Text(size, style: TextStyle(fontSize: 11, color: muted)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.download_rounded, size: 20, color: muted),
            ]),
          ),
        ),
      ),
    );
  }
}
