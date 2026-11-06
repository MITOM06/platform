import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/utils/global_messenger.dart';
import 'room_controls.dart';

/// Permanent "AI is taking notes" chip while the switch is on, plus a one-time
/// banner when it flips on mid-meeting (not when the room opens already on) —
/// mirror of web `AiNotesIndicator`.
class AiNotesIndicator extends StatefulWidget {
  const AiNotesIndicator(
      {super.key, required this.active, this.sharing = false, this.announce});

  final bool active;

  /// I am sharing my screen and its frames are being read by the AI.
  final bool sharing;

  /// Shows the one-time banner text; defaults to the app's top banner.
  final void Function(String text)? announce;

  @override
  State<AiNotesIndicator> createState() => _AiNotesIndicatorState();
}

class _AiNotesIndicatorState extends State<AiNotesIndicator> {
  @override
  void didUpdateWidget(AiNotesIndicator old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) {
      (widget.announce ?? showInfoSnackBar)(context.l10n.meetingAiNotesStarted);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) return const SizedBox.shrink();
    final l = context.l10n;
    return Semantics(
      liveRegion: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Chip(l.meetingAiNotesActive),
          if (widget.sharing) ...[
            const SizedBox(height: 6),
            _Chip(l.meetingAiReadingScreen),
          ],
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
          color: kStagePill, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.auto_awesome_rounded, size: 14, color: Colors.white),
        const SizedBox(width: 6),
        Flexible(
          child: Text(text,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w500)),
        ),
      ]),
    );
  }
}
