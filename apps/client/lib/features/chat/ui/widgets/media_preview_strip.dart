import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/staged_attachments_provider.dart';

/// Messenger-style preview strip above the composer while attachments are
/// staged (not yet uploaded). The user can add more, remove individual items,
/// and toggle HD/SD for the whole batch with a single global button before
/// pressing Send. Mirrors the web `MediaPreviewStrip`.
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
    final hasImages = attachments.any((a) => a.type == 'image');
    final isAllHD = ref.watch(isAllHDProvider(conversationId));

    return Container(
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        border: Border(top: BorderSide(color: borderColor, width: 1)),
      ),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header: single global HD toggle (images only)
          if (hasImages)
            Align(
              alignment: Alignment.centerRight,
              child: _HdToggle(
                isAllHD: isAllHD,
                onTap: () {
                  ref.read(isAllHDProvider(conversationId).notifier).state =
                      !isAllHD;
                },
              ),
            ),
          if (hasImages) const SizedBox(height: 8),
          SizedBox(
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
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Single global HD/SD toggle shown in the strip header.
class _HdToggle extends StatelessWidget {
  final bool isAllHD;
  final VoidCallback onTap;

  const _HdToggle({required this.isAllHD, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Tooltip(
        message:
            isAllHD ? context.l10n.attachHdOn : context.l10n.attachHdOff,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: isAllHD
                ? AppTheme.ponCyan.withValues(alpha: 0.15)
                : Colors.white.withValues(alpha: 0.08),
            border: Border.all(
              color: isAllHD
                  ? AppTheme.ponCyan.withValues(alpha: 0.5)
                  : Colors.white24,
            ),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.bolt,
                  size: 12,
                  color: isAllHD ? AppTheme.ponCyan : Colors.white38),
              const SizedBox(width: 3),
              Text(
                isAllHD ? context.l10n.hdOn : context.l10n.hdOff,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: isAllHD ? AppTheme.ponCyan : Colors.white38,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StagedTile extends StatelessWidget {
  final StagedAttachment attachment;
  final VoidCallback onRemove;

  const _StagedTile({
    required this.attachment,
    required this.onRemove,
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
