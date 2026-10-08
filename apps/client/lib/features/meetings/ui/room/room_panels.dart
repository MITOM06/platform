import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../state/meeting_room_state.dart';
import 'meeting_chat_sheet.dart';
import 'meeting_room_scope.dart';
import 'notes_sheet.dart';
import 'participants_sheet.dart';
import 'room_sheet.dart';

/// Opens People / Chat / Notes as an 85 % bottom sheet — web `SidePanel` on
/// phones. The room store's `panel` follows the sheet (chat unread is
/// cleared while it is open). [context] is the room page's.
Future<void> openRoomPanel(BuildContext context, RoomPanel panel,
    {bool scrollToManage = false}) async {
  final controller = MeetingRoomScope.read(context).controller;
  final l = context.l10n;
  controller.setPanel(panel);
  await showRoomSheet<void>(
    context,
    title: switch (panel) {
      RoomPanel.people => l.meetingPeopleTitle,
      RoomPanel.chat => l.meetingChatTitle,
      RoomPanel.notes => l.meetingNotes,
    },
    builder: (_) => switch (panel) {
      RoomPanel.people => ParticipantsSheet(scrollToManage: scrollToManage),
      RoomPanel.chat => const MeetingChatSheet(),
      RoomPanel.notes => const NotesSheet(),
    },
  );
  controller.setPanel(null);
}
