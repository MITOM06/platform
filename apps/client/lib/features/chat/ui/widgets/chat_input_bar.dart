import 'dart:async';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

class ChatInputBar extends StatefulWidget {
  final TextEditingController controller;
  final VoidCallback onSend;
  final VoidCallback onAttach;
  final ValueChanged<String> onChanged;
  final VoidCallback onEmojiToggle;
  final bool emojiActive;
  final String quickReactionEmoji;
  final VoidCallback onQuickReaction;
  // Whether the composer has staged (not-yet-sent) attachments — shows the
  // send button even when the text field is empty.
  final bool hasAttachments;
  // Called with the local file path of the recorded audio when the user stops.
  final Future<void> Function(String path)? onVoiceSend;

  const ChatInputBar({
    super.key,
    required this.controller,
    required this.onSend,
    required this.onAttach,
    required this.onChanged,
    required this.onEmojiToggle,
    required this.emojiActive,
    required this.quickReactionEmoji,
    required this.onQuickReaction,
    this.hasAttachments = false,
    this.onVoiceSend,
  });

  @override
  State<ChatInputBar> createState() => _ChatInputBarState();
}

class _ChatInputBarState extends State<ChatInputBar> {
  bool _hasText = false;
  bool _isRecording = false;
  int _recordingSeconds = 0;
  Timer? _recordingTimer;
  final AudioRecorder _recorder = AudioRecorder();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_textListener);
  }

  void _textListener() {
    final hasText = widget.controller.text.trim().isNotEmpty;
    if (hasText != _hasText) setState(() => _hasText = hasText);
  }

  @override
  void dispose() {
    _recordingTimer?.cancel();
    _recorder.dispose();
    widget.controller.removeListener(_textListener);
    super.dispose();
  }

  Future<void> _startRecording() async {
    final hasPermission = await _recorder.hasPermission();
    if (!hasPermission || !mounted) return;
    final dir = await getTemporaryDirectory();
    final path =
        '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(
      const RecordConfig(encoder: AudioEncoder.aacLc),
      path: path,
    );
    if (!mounted) return;
    setState(() {
      _isRecording = true;
      _recordingSeconds = 0;
    });
    _recordingTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _recordingSeconds++);
    });
  }

  Future<void> _stopAndSend() async {
    _recordingTimer?.cancel();
    _recordingTimer = null;
    final path = await _recorder.stop();
    if (!mounted) return;
    setState(() {
      _isRecording = false;
      _recordingSeconds = 0;
    });
    if (path != null) {
      await widget.onVoiceSend?.call(path);
    }
  }

  Future<void> _cancelRecording() async {
    _recordingTimer?.cancel();
    _recordingTimer = null;
    await _recorder.stop();
    if (!mounted) return;
    setState(() {
      _isRecording = false;
      _recordingSeconds = 0;
    });
  }

  String _fmtSeconds(int s) {
    final m = (s ~/ 60).toString().padLeft(2, '0');
    final sec = (s % 60).toString().padLeft(2, '0');
    return '$m:$sec';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final borderColor = AppTheme.hairline(context);
    final textColor = Theme.of(context).colorScheme.onSurface;
    final hintColor = AppTheme.mutedText(context);
    final fillColor = Theme.of(context).colorScheme.surface;
    final fieldBorderColor = AppTheme.hairline(context);

    return Container(
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        border: Border(
          top: BorderSide(color: borderColor, width: 1),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: SafeArea(
        top: false,
        child: _isRecording
            ? _buildRecordingRow(isDark)
            : _buildNormalRow(
                textColor, hintColor, fillColor, fieldBorderColor),
      ),
    );
  }

  Widget _buildRecordingRow(bool isDark) {
    return Row(
      children: [
        const Icon(Icons.mic, color: Colors.redAccent, size: 22),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            '${context.l10n.recording}  ${_fmtSeconds(_recordingSeconds)}',
            style: TextStyle(
              color: AppTheme.mutedText(context),
              fontSize: 15,
            ),
          ),
        ),
        IconButton(
          tooltip: context.l10n.actionCancel,
          onPressed: _cancelRecording,
          icon: Icon(
            Icons.delete_outline_rounded,
            color: AppTheme.mutedText(context),
          ),
        ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: AppTheme.ponAccent,
          ),
          child: IconButton(
            onPressed: _stopAndSend,
            icon: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
          ),
        ),
      ],
    );
  }

  Widget _buildNormalRow(
    Color textColor,
    Color hintColor,
    Color fillColor,
    Color fieldBorderColor,
  ) {
    return Row(
      children: [
        IconButton(
          onPressed: widget.onEmojiToggle,
          icon: Icon(
            widget.emojiActive
                ? Icons.keyboard_rounded
                : Icons.emoji_emotions_outlined,
            color: AppTheme.ponAccent.withValues(alpha: 0.8),
          ),
        ),
        IconButton(
          onPressed: widget.onAttach,
          icon: Icon(
            Icons.add_photo_alternate_outlined,
            color: AppTheme.ponAccent.withValues(alpha: 0.85),
          ),
        ),
        Expanded(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            child: TextField(
              controller: widget.controller,
              onChanged: widget.onChanged,
              onSubmitted: (_) => widget.onSend(),
              textInputAction: TextInputAction.send,
              style: TextStyle(color: textColor, fontSize: 15),
              decoration: InputDecoration(
                hintText: context.l10n.messageHint,
                hintStyle: TextStyle(color: hintColor),
                filled: true,
                fillColor: fillColor,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 10,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radiusControl),
                  borderSide: BorderSide(color: fieldBorderColor, width: 1),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radiusControl),
                  borderSide: BorderSide(color: fieldBorderColor, width: 1),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radiusControl),
                  borderSide:
                      const BorderSide(color: AppTheme.ponAccent, width: 1.5),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        if (_hasText || widget.hasAttachments)
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: AppTheme.ponAccent,
            ),
            child: IconButton(
              onPressed: widget.onSend,
              icon: const Icon(
                Icons.send_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
          )
        else if (widget.onVoiceSend != null)
          IconButton(
            tooltip: context.l10n.voiceMicTooltip,
            onPressed: _startRecording,
            icon: Icon(
              Icons.mic_none_outlined,
              color: AppTheme.ponAccent.withValues(alpha: 0.8),
            ),
          )
        else
          Container(
            decoration: const BoxDecoration(shape: BoxShape.circle),
            child: IconButton(
              onPressed: widget.onQuickReaction,
              icon: Text(
                widget.quickReactionEmoji,
                style: const TextStyle(fontSize: 22),
              ),
            ),
          ),
      ],
    );
  }
}
