import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../l10n/app_localizations.dart';
import '../../domain/meeting_room_models.dart';
import '../../state/meeting_room_controller.dart';
import 'room_sheet.dart';

(IconData, String) _item(AppLocalizations l, HostAction a) => switch (a) {
      HostAction.muteMic => (Icons.mic_off_rounded, l.meetingActionMuteMic),
      HostAction.lowerHand => (
          Icons.back_hand_rounded,
          l.meetingActionLowerHand
        ),
      HostAction.makeCohost => (
          Icons.add_moderator_rounded,
          l.meetingActionMakeCohost
        ),
      HostAction.revokeCohost => (
          Icons.remove_moderator_rounded,
          l.meetingActionRevokeCohost
        ),
      _ => (Icons.person_remove_rounded, l.meetingActionRemove),
    };

/// Per-person host menu (from `personActions`); removing asks first. Every
/// action is a `/app/meet.host` command — mirror of web `HostMenu`.
/// [name] is already humanized (never an id). [context] must outlive the
/// sheet (the confirm dialog opens on it).
Future<void> showHostActionsSheet(
  BuildContext context, {
  required MeetingRoomController controller,
  required String userId,
  required String name,
  required List<HostAction> actions,
}) async {
  final l = context.l10n;
  final picked = await showRoomSheet<HostAction>(
    context,
    tall: false,
    title: name,
    builder: (sheet) {
      final error = Theme.of(sheet).colorScheme.error;
      return Column(mainAxisSize: MainAxisSize.min, children: [
        for (final a in actions)
          Builder(builder: (_) {
            final (icon, label) = _item(l, a);
            final danger = a == HostAction.remove;
            return ListTile(
              leading: Icon(icon, color: danger ? error : null),
              title:
                  Text(label, style: danger ? TextStyle(color: error) : null),
              onTap: () => Navigator.of(sheet).pop(a),
            );
          }),
      ]);
    },
  );
  if (picked == null || !context.mounted) return;
  if (picked == HostAction.remove && !await _confirmRemove(context, name)) {
    return;
  }
  controller.hostCommand(picked, userId);
}

Future<bool> _confirmRemove(BuildContext context, String name) async {
  final l = context.l10n;
  final error = Theme.of(context).colorScheme.error;
  final ok = await showDialog<bool>(
    context: context,
    builder: (d) => AlertDialog(
      title: Text(l.meetingRemoveConfirmTitle(name)),
      content: Text(l.meetingRemoveConfirmDesc),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(d).pop(false),
            child: Text(l.actionCancel)),
        TextButton(
          onPressed: () => Navigator.of(d).pop(true),
          style: TextButton.styleFrom(foregroundColor: error),
          child: Text(l.meetingActionRemove),
        ),
      ],
    ),
  );
  return ok ?? false;
}
