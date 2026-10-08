import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/meeting_models.dart';
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

  void _send() {
    final controller = MeetingRoomScope.read(context).controller;
    if (controller.sendChat(_text.text) != null) {
      _text.clear();
      widget.onSent?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final online = ref.watch(stompConnectedProvider).valueOrNull ?? true;
    final length = _text.text.length;
    final tooLong = length > MeetingLimits.chat;
    final canSend = online && !tooLong && _text.text.trim().isNotEmpty;
    final muted = TextStyle(fontSize: 12, color: AppTheme.mutedText(context));
    return Container(
      decoration: BoxDecoration(
          border: Border(top: BorderSide(color: AppTheme.hairline(context)))),
      padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (!online)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(l.meetingChatOffline, style: muted),
          ),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
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
            onPressed: canSend ? _send : null,
            icon: const Icon(Icons.send_rounded, size: 20),
          ),
        ]),
        if (tooLong)
          Padding(
            padding: const EdgeInsets.only(top: 4),
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
