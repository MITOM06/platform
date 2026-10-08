import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/meeting_room_models.dart';
import 'meeting_room_scope.dart';
import 'room_sheet.dart';

/// The six reactions (web `ReactionPicker`). Too fast (more than one a
/// second) ⇒ a light haptic, nothing is sent.
Future<void> showReactionPicker(BuildContext context) => showRoomSheet<void>(
      context,
      tall: false,
      title: context.l10n.meetingReactions,
      builder: (_) => const _Picker(),
    );

class _Picker extends StatelessWidget {
  const _Picker();

  @override
  Widget build(BuildContext context) {
    final controller = MeetingRoomScope.of(context).controller;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 4,
        runSpacing: 4,
        children: [
          for (final emoji in kReactionEmojis)
            Semantics(
              button: true,
              label: emoji,
              excludeSemantics: true,
              child: InkResponse(
                radius: 28,
                onTap: () {
                  if (controller.sendReaction(emoji)) {
                    Navigator.of(context).pop();
                  } else {
                    HapticFeedback.selectionClick();
                  }
                },
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: Center(
                      child: Text(emoji, style: const TextStyle(fontSize: 28))),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
