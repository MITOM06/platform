import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../data/chat_repository.dart';
import '../domain/chat_provider.dart';
import '../domain/staged_attachments_provider.dart';

/// Uploads a locally recorded audio file and sends it as a voice message,
/// then runs [onSent] (e.g. to scroll to the bottom). Extracted from
/// chat_screen.dart for the clean-code file limit; behaviour is unchanged.
Future<void> sendVoiceMessage(
  BuildContext context,
  WidgetRef ref,
  String conversationId,
  String path,
  VoidCallback onSent,
) async {
  final l10n = context.l10n;
  final messenger = ScaffoldMessenger.of(context);
  messenger.showSnackBar(SnackBar(content: Text(l10n.uploading)));
  try {
    final List<int> bytes;
    bytes = await File(path).readAsBytes();
    final filename = 'voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
    final uploaded =
        await ref.read(chatRepositoryProvider).uploadDocument(bytes, filename);
    await ref
        .read(chatNotifierProvider(conversationId).notifier)
        .sendMessage(uploaded.url, type: 'voice');
    onSent();
  } catch (_) {
    if (context.mounted) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.uploadFailed)));
    }
  }
}

/// Pick an image / video / document and STAGE it in the composer preview strip
/// (upload happens on Send, mirroring web). Documents are single-shot; images
/// and videos append to the strip.
Future<void> pickAndStageMedia(
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
  final notifier = ref.read(stagedAttachmentsProvider(conversationId).notifier);

  if (source == 'file') {
    final result = await FilePicker.platform.pickFiles(withData: true);
    if (result == null || result.files.isEmpty) return;
    final picked = result.files.first;
    final bytes = picked.bytes;
    if (bytes == null) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.uploadFailed)));
      }
      return;
    }
    notifier.addDocument(bytes, picked.name);
    return;
  }

  final picker = ImagePicker();
  if (source == 'video') {
    final XFile? file = await picker.pickVideo(source: ImageSource.gallery);
    if (file == null) return;
    notifier.addVideo(file);
    return;
  }

  final List<XFile> files = await picker.pickMultiImage();
  notifier.addImages(files);
}

/// "Add more" from the preview strip — pick additional images and stage them.
Future<void> pickAndStageImages(
  WidgetRef ref,
  String conversationId,
) async {
  final files = await ImagePicker().pickMultiImage();
  ref.read(stagedAttachmentsProvider(conversationId).notifier).addImages(files);
}

/// Upload + send everything staged in the composer, surfacing a localized error
/// on failure. Returns true when there was nothing staged (so the caller can
/// fall back to sending the text message).
Future<bool> flushStagedAttachments(
  BuildContext context,
  WidgetRef ref,
  String conversationId,
) async {
  final notifier = ref.read(stagedAttachmentsProvider(conversationId).notifier);
  if (notifier.isEmpty) return true;
  final messenger = ScaffoldMessenger.of(context);
  final failedMsg = context.l10n.uploadFailed;
  messenger.showSnackBar(SnackBar(content: Text(context.l10n.uploading)));
  try {
    await notifier.flush();
  } catch (_) {
    messenger.showSnackBar(SnackBar(content: Text(failedMsg)));
  }
  return false;
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

// ---------------------------------------------------------------------------
// Composer text utilities (mention detection + emoji insertion). Extracted
// from chat_screen.dart for the clean-code file limit; behaviour is unchanged.
// ---------------------------------------------------------------------------

/// Returns the active @mention token currently being typed — the text after
/// the last '@' that begins a word up to the caret — or null when the caret is
/// not inside a mention.
String? activeMentionQuery(TextEditingController controller) {
  final sel = controller.selection;
  if (!sel.isValid || sel.start < 0) return null;
  final caret = sel.start;
  final text = controller.text;
  if (caret > text.length) return null;
  final before = text.substring(0, caret);
  final at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !RegExp(r'\s').hasMatch(before[at - 1])) return null;
  final token = before.substring(at + 1);
  if (token.contains('\n') || token.length > 30) return null;
  return token;
}

/// Replaces the in-progress @mention at the caret with `@displayName ` and
/// moves the caret after it. Returns true when a mention was applied (so the
/// caller can clear its mention-query state), false when there was nothing to
/// replace.
bool applyMentionToController(
    TextEditingController controller, String displayName) {
  final sel = controller.selection;
  final caret = sel.start < 0 ? controller.text.length : sel.start;
  final text = controller.text;
  final before = text.substring(0, caret);
  final at = before.lastIndexOf('@');
  if (at < 0) return false;
  final insert = '@$displayName ';
  final newText = text.substring(0, at) + insert + text.substring(caret);
  controller.value = TextEditingValue(
    text: newText,
    selection: TextSelection.collapsed(offset: at + insert.length),
  );
  return true;
}

/// Inserts [emoji] at the caret, replacing any active selection, and keeps the
/// caret positioned after the inserted emoji.
void insertEmojiIntoController(TextEditingController controller, String emoji) {
  final text = controller.text;
  final sel = controller.selection;
  final start = sel.start < 0 ? text.length : sel.start;
  final end = sel.end < 0 ? text.length : sel.end;
  final newText = text.replaceRange(start, end, emoji);
  controller.value = TextEditingValue(
    text: newText,
    selection: TextSelection.collapsed(offset: start + emoji.length),
  );
}
