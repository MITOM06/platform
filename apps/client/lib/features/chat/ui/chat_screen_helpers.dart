import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../data/chat_repository.dart';
import '../domain/chat_provider.dart';

/// Pick an image or video, upload to GridFS, then send as a chat message.
Future<void> pickAndSendMedia(
  BuildContext context,
  WidgetRef ref,
  String conversationId,
) async {
  final l10n = context.l10n;
  final theme = Theme.of(context);
  final isDark = theme.brightness == Brightness.dark;
  final sheetColor = isDark ? AppTheme.darkSurface : theme.cardColor;
  final textColor = isDark ? Colors.white : Colors.black87;
  final source = await showModalBottomSheet<String>(
    context: context,
    backgroundColor: sheetColor,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          ListTile(
            leading: const Icon(Icons.photo_outlined, color: AppTheme.ponCyan),
            title: Text(l10n.attachPhoto,
                style: TextStyle(color: textColor)),
            onTap: () => Navigator.pop(ctx, 'image'),
          ),
          ListTile(
            leading: const Icon(Icons.videocam_outlined, color: AppTheme.ponPeach),
            title: Text(l10n.attachVideo,
                style: TextStyle(color: textColor)),
            onTap: () => Navigator.pop(ctx, 'video'),
          ),
          ListTile(
            leading: const Icon(Icons.insert_drive_file_outlined,
                color: AppTheme.ponCyan),
            title: Text(l10n.attachFile,
                style: TextStyle(color: textColor)),
            onTap: () => Navigator.pop(ctx, 'file'),
          ),
        ],
      ),
    ),
  );
  if (source == null || !context.mounted) return;

  if (source == 'file') {
    await pickAndSendDocument(context, ref, conversationId);
    return;
  }

  final picker = ImagePicker();

  if (source == 'video') {
    final XFile? file = await picker.pickVideo(source: ImageSource.gallery);
    if (file == null || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(SnackBar(content: Text(context.l10n.uploading)));
    try {
      final url = await ref.read(chatRepositoryProvider).uploadFile(file);
      await ref
          .read(chatNotifierProvider(conversationId).notifier)
          .sendMessage(url, type: 'video');
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.uploadFailed)));
    }
    return;
  }

  // Multi-image pick
  final List<XFile> files = await picker.pickMultiImage();
  if (files.isEmpty || !context.mounted) return;
  final messenger = ScaffoldMessenger.of(context);
  messenger.showSnackBar(SnackBar(content: Text(context.l10n.uploading)));
  try {
    final repo = ref.read(chatRepositoryProvider);
    final urls = await Future.wait(files.map((f) => repo.uploadFile(f)));
    // Single image → plain URL; multiple → JSON array for grid layout
    final content = urls.length == 1 ? urls.first : jsonEncode(urls);
    await ref
        .read(chatNotifierProvider(conversationId).notifier)
        .sendMessage(content, type: 'image');
  } catch (_) {
    messenger.showSnackBar(SnackBar(content: Text(l10n.uploadFailed)));
  }
}

/// Pick a generic document (PDF / DOC / ZIP …), upload, then send as `file` message.
Future<void> pickAndSendDocument(
  BuildContext context,
  WidgetRef ref,
  String conversationId,
) async {
  final l10n = context.l10n;
  final result = await FilePicker.platform.pickFiles(withData: true);
  if (result == null || result.files.isEmpty || !context.mounted) return;
  final picked = result.files.first;
  final bytes = picked.bytes;
  if (bytes == null) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(l10n.uploadFailed)));
    return;
  }

  final messenger = ScaffoldMessenger.of(context);
  messenger.showSnackBar(SnackBar(content: Text(l10n.uploading)));
  try {
    final uploaded =
        await ref.read(chatRepositoryProvider).uploadDocument(bytes, picked.name);
    final content = jsonEncode(
        {'url': uploaded.url, 'name': uploaded.name, 'size': uploaded.size});
    await ref
        .read(chatNotifierProvider(conversationId).notifier)
        .sendMessage(content, type: 'file');
  } catch (_) {
    messenger.showSnackBar(SnackBar(content: Text(l10n.uploadFailed)));
  }
}

/// Show the auto-delete duration picker sheet.
Future<void> showAutoDeletePicker(
  BuildContext context,
  WidgetRef ref,
  String conversationId,
) async {
  final l10n = context.l10n;
  final theme = Theme.of(context);
  final isDark = theme.brightness == Brightness.dark;
  final sheetColor = isDark ? AppTheme.darkSurface : theme.cardColor;
  final textColor = isDark ? Colors.white : Colors.black87;
  final seconds = await showModalBottomSheet<int?>(
    context: context,
    backgroundColor: sheetColor,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Text(l10n.disappearingMessages,
              style: TextStyle(
                  color: textColor, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ListTile(
            title: Text(l10n.disappearingOff,
                style: TextStyle(color: textColor)),
            onTap: () => Navigator.pop(ctx, 0),
          ),
          ListTile(
            title: Text(l10n.disappearing24h,
                style: TextStyle(color: textColor)),
            onTap: () => Navigator.pop(ctx, 86400),
          ),
          ListTile(
            title: Text(l10n.disappearing7d,
                style: TextStyle(color: textColor)),
            onTap: () => Navigator.pop(ctx, 604800),
          ),
        ],
      ),
    ),
  );
  if (seconds == null) return;
  try {
    await ref
        .read(chatRepositoryProvider)
        .setAutoDelete(conversationId, seconds == 0 ? null : seconds);
  } catch (_) {}
}

/// Show a simple confirmation dialog. Returns true when the user confirms.
Future<bool?> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String body,
}) {
  final theme = Theme.of(context);
  final isDark = theme.brightness == Brightness.dark;
  final dialogColor = isDark ? AppTheme.darkSurface : Colors.white;
  final titleColor = isDark ? Colors.white : Colors.black87;
  final bodyColor = isDark ? Colors.white70 : Colors.black54;
  return showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: dialogColor,
      title: Text(title, style: TextStyle(color: titleColor)),
      content: Text(body, style: TextStyle(color: bodyColor)),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(ctx.l10n.actionCancel),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Colors.redAccent),
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(ctx.l10n.actionConfirm),
        ),
      ],
    ),
  );
}
