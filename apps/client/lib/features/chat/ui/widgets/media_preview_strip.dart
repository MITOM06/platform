import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/staged_attachments_provider.dart';

/// Messenger-style preview strip above the composer while attachments are
/// staged (not yet uploaded). The user can add more, remove individual items,
/// and toggle HD/SD per image before pressing Send. Mirrors the web
/// `MediaPreviewStrip`.
class MediaPreviewStrip extends ConsumerWidget {
  final String conversationId;
  final VoidCallback onAddMore;

  const MediaPreviewStrip({
    super.key,
    required this.conversationId,
    required this.onAddMore,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attachments = ref.watch(stagedAttachmentsProvider(conversationId));
    if (attachments.isEmpty) return const SizedBox.shrink();
    final notifier =
        ref.read(stagedAttachmentsProvider(conversationId).notifier);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final borderColor = isDark
        ? AppTheme.darkBorder.withValues(alpha: 0.4)
        : Colors.black.withValues(alpha: 0.1);
    final isMedia = attachments.first.type != 'file';

    return Container(
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        border: Border(top: BorderSide(color: borderColor, width: 1)),
      ),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
      child: SizedBox(
        height: 84,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: attachments.length + (isMedia ? 1 : 0),
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (context, index) {
            if (index == attachments.length) {
              return _AddMoreButton(
                borderColor: borderColor,
                onTap: onAddMore,
                label: context.l10n.addMore,
              );
            }
            final att = attachments[index];
            return _StagedTile(
              attachment: att,
              onRemove: () => notifier.remove(att.id),
              onToggleHD: () => notifier.toggleHD(att.id),
            );
          },
        ),
      ),
    );
  }
}

class _StagedTile extends StatelessWidget {
  final StagedAttachment attachment;
  final VoidCallback onRemove;
  final VoidCallback onToggleHD;

  const _StagedTile({
    required this.attachment,
    required this.onRemove,
    required this.onToggleHD,
  });

  @override
  Widget build(BuildContext context) {
    final att = attachment;
    Widget thumb;
    if (att.type == 'image' && att.file != null) {
      thumb = ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.file(
          File(att.file!.path),
          width: 76,
          height: 76,
          fit: BoxFit.cover,
        ),
      );
    } else if (att.type == 'video') {
      thumb = const _IconTile(
        icon: Icons.videocam_rounded,
        width: 76,
        label: null,
      );
    } else {
      thumb = _IconTile(
        icon: Icons.insert_drive_file_rounded,
        width: 104,
        label: att.docName,
      );
    }

    return Stack(
      clipBehavior: Clip.none,
      children: [
        thumb,
        // Remove button
        Positioned(
          top: -6,
          right: -6,
          child: GestureDetector(
            onTap: onRemove,
            child: Container(
              width: 22,
              height: 22,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.black87,
              ),
              child: const Icon(Icons.close, size: 14, color: Colors.white),
            ),
          ),
        ),
        // HD toggle — images only
        if (att.type == 'image')
          Positioned(
            bottom: 4,
            left: 4,
            child: GestureDetector(
              onTap: onToggleHD,
              child: Tooltip(
                message: att.isHD
                    ? context.l10n.attachHdOn
                    : context.l10n.attachHdOff,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: att.isHD
                        ? AppTheme.ponCyan.withValues(alpha: 0.9)
                        : Colors.black.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.bolt,
                          size: 11,
                          color: att.isHD ? Colors.black : Colors.white70),
                      Text(
                        'HD',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: att.isHD ? Colors.black : Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _IconTile extends StatelessWidget {
  final IconData icon;
  final double width;
  final String? label;

  const _IconTile({required this.icon, required this.width, this.label});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: width,
      height: 76,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: isDark
            ? AppTheme.darkSurface.withValues(alpha: 0.7)
            : Colors.black.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 26, color: AppTheme.ponCyan),
          if (label != null) ...[
            const SizedBox(height: 2),
            Text(
              label!,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 9,
                color: isDark ? Colors.white60 : Colors.black54,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AddMoreButton extends StatelessWidget {
  final Color borderColor;
  final VoidCallback onTap;
  final String label;

  const _AddMoreButton({
    required this.borderColor,
    required this.onTap,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 76,
        height: 76,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor, width: 1.5),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.add, size: 24, color: AppTheme.ponCyan),
            Text(
              label,
              style: const TextStyle(fontSize: 9, color: AppTheme.ponCyan),
            ),
          ],
        ),
      ),
    );
  }
}
