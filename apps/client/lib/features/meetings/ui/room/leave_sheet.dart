import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../state/meeting_room_controller.dart';
import 'room_sheet.dart';

enum _LeaveChoice { leave, end }

/// Host / co-host: Leave meeting (the meeting goes on) or End meeting for all
/// (confirmed) — mirror of web `LeaveMenu`. Attendees (system back) only get
/// Leave. [context] must outlive the sheet (the confirm dialog opens on it).
Future<void> showLeaveSheet(BuildContext context,
    {required MeetingRoomController controller, required bool manager}) async {
  final choice = await showRoomSheet<_LeaveChoice>(
    context,
    tall: false,
    title: context.l10n.meetingLeave,
    builder: (sheet) => _LeaveOptions(manager: manager),
  );
  if (!context.mounted) return;
  switch (choice) {
    case _LeaveChoice.leave:
      controller.leave();
    case _LeaveChoice.end:
      final ok = await _confirmEnd(context);
      if (ok) unawaited(controller.endForAll());
    case null:
      break;
  }
}

Future<bool> _confirmEnd(BuildContext context) async {
  final l = context.l10n;
  final error = Theme.of(context).colorScheme.error;
  final ok = await showDialog<bool>(
    context: context,
    builder: (d) => AlertDialog(
      title: Text(l.meetingEndConfirmTitle),
      content: Text(l.meetingEndConfirmDesc),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(d).pop(false),
            child: Text(l.actionCancel)),
        TextButton(
          onPressed: () => Navigator.of(d).pop(true),
          style: TextButton.styleFrom(foregroundColor: error),
          child: Text(l.meetingEndForAll),
        ),
      ],
    ),
  );
  return ok ?? false;
}

class _LeaveOptions extends StatelessWidget {
  const _LeaveOptions({required this.manager});

  final bool manager;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final error = Theme.of(context).colorScheme.error;
    return Column(mainAxisSize: MainAxisSize.min, children: [
      ListTile(
        leading: const Icon(Icons.logout_rounded),
        title: Text(l.meetingLeaveMeeting),
        onTap: () => Navigator.of(context).pop(_LeaveChoice.leave),
      ),
      if (manager)
        ListTile(
          leading: Icon(Icons.cancel_rounded, color: error),
          title: Text(l.meetingEndForAll, style: TextStyle(color: error)),
          onTap: () => Navigator.of(context).pop(_LeaveChoice.end),
        ),
    ]);
  }
}
