import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/meeting_attachment.dart';
import '../../domain/meeting_models.dart';
import '../../state/meeting_attach.dart';
import '../../state/meeting_room_providers.dart';
import 'meeting_room_scope.dart';

/// The counter shows up from here on.
const _counterFrom = 1800;

/// Message box of the meeting chat — mirror of web `MeetingChatComposer`.
class ChatComposer extends ConsumerStatefulWidget {
  const ChatComposer({super.key, this.onSent});

  /// My own line went out (the list scrolls to it).
  final VoidCallback? onSent;

  @override
  ConsumerState<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends ConsumerState<ChatComposer> {
  final _text = TextEditingController();

  /// Uploaded but not delivered yet (the send was refused): kept so the next
  /// Send does not upload again.
  MeetingAttachment? _staged;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _text.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _toast(String message) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(message)));

  /// Sends the CURRENT text (read now, not before the upload: what was typed
  /// meanwhile is kept) with the staged file, if any.
  void _deliver() {
    final controller = MeetingRoomScope.read(context).controller;
    final file = _staged;
    if (controller.sendChat(_text.text, attachment: file) == null) {
      if (file != null) _toast(context.l10n.meetingChatNotSent);
      return;
    }
    setState(() => _staged = null);
    _text.clear();
    widget.onSent?.call();
  }

  Future<void> _attach() async {
    final l = context.l10n;
    if (_text.text.length > MeetingLimits.chat) {
      _toast(l.meetingErrChatTooLong(MeetingLimits.chat));
      return;
    }
    final picked = await ref.read(meetingFilePickerProvider)();
    if (picked == null || !mounted) return;
    if (picked.bytes.length > kMeetingFileMaxBytes) {
      _toast(l.meetingChatFileTooLarge);
      return;
    }
    setState(() => _uploading = true);
    try {
      final up =
          await ref.read(meetingUploaderProvider)(picked.bytes, picked.name);
      if (!mounted) return;
      _staged = MeetingAttachment(
          url: up.url, name: up.name, size: up.size, contentType: null);
      _deliver();
    } catch (e) {
      if (mounted) {
        final big = e is DioException && e.response?.statusCode == 413;
        _toast(big ? l.meetingChatFileTooLarge : l.meetingChatUploadFailed);
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final online = ref.watch(stompConnectedProvider).valueOrNull ?? true;
    final length = _text.text.length;
    final tooLong = length > MeetingLimits.chat;
    final canSend = online &&
        !_uploading &&
        !tooLong &&
        (_text.text.trim().isNotEmpty || _staged != null);
    final muted = TextStyle(fontSize: 12, color: AppTheme.mutedText(context));
    final staged = _staged;
    return Container(
      decoration: BoxDecoration(
          border: Border(top: BorderSide(color: AppTheme.hairline(context)))),
      padding: const EdgeInsets.fromLTRB(4, 8, 8, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (!online)
          Padding(
            padding: const EdgeInsets.only(left: 8, bottom: 6),
            child: Text(l.meetingChatOffline, style: muted),
          ),
        if (_uploading)
          Padding(
            padding: const EdgeInsets.only(left: 8, bottom: 6),
            child: Text(l.meetingChatUploading, style: muted),
          ),
        if (staged != null)
          _StagedChip(
              name: staged.name,
              onRemove: () => setState(() => _staged = null)),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          IconButton(
            tooltip: l.meetingChatAttach,
            onPressed: online && !_uploading ? _attach : null,
            icon: const Icon(Icons.attach_file_rounded, size: 22),
          ),
          Expanded(
            child: Semantics(
              label: l.meetingChatPlaceholder,
              child: TextField(
                controller: _text,
                enabled: online,
                minLines: 1,
                maxLines: 5,
                // Return adds a line (web: Shift+Enter); the button sends.
                keyboardType: TextInputType.multiline,
                textInputAction: TextInputAction.newline,
                decoration: InputDecoration(
                  hintText: l.meetingChatPlaceholder,
                  isDense: true,
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),
          IconButton.filled(
            tooltip: l.meetingChatSend,
            onPressed: canSend ? _deliver : null,
            icon: const Icon(Icons.send_rounded, size: 20),
          ),
        ]),
        if (tooLong)
          Padding(
            padding: const EdgeInsets.only(left: 8, top: 4),
            child: Text(l.meetingErrChatTooLong(MeetingLimits.chat),
                style: TextStyle(
                    fontSize: 12, color: Theme.of(context).colorScheme.error)),
          )
        else if (length > _counterFrom)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(l.meetingChatCounter(length, MeetingLimits.chat),
                textAlign: TextAlign.end, style: muted),
          ),
      ]),
    );
  }
}

/// The uploaded file waiting to go out, with a remove button.
class _StagedChip extends StatelessWidget {
  const _StagedChip({required this.name, required this.onRemove});

  final String name;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 8, bottom: 6),
        child: Align(
          alignment: Alignment.centerLeft,
          child: InputChip(
            avatar: const Icon(Icons.attach_file_rounded, size: 16),
            label: Text(name, overflow: TextOverflow.ellipsis),
            deleteButtonTooltipMessage: context.l10n.meetingChatRemoveFile,
            onDeleted: onRemove,
          ),
        ),
      );
}
