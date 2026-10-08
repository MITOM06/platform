import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/permissions.dart';
import '../../domain/stage_layout.dart';
import '../../state/meeting_room_providers.dart';
import '../../state/meeting_room_state.dart';
import 'meeting_room_scope.dart';
import 'room_panels.dart';
import 'room_sheet.dart';

enum _More { people, chat, notes, share, switchCamera, manage }

/// "More options" on phones: the panels, presenting (Android), camera side,
/// loudspeaker, layout and host controls — mirror of web `ControlBarMore`
/// (compact). [context] must outlive the sheet (panels open on it).
Future<void> showRoomMoreSheet(BuildContext context) async {
  final controller = MeetingRoomScope.read(context).controller;
  final choice = await showRoomSheet<_More>(context,
      tall: false,
      title: context.l10n.meetingMore,
      builder: (_) => const _MoreList());
  if (!context.mounted) return;
  switch (choice) {
    case _More.people:
      return openRoomPanel(context, RoomPanel.people);
    case _More.chat:
      return openRoomPanel(context, RoomPanel.chat);
    case _More.notes:
      return openRoomPanel(context, RoomPanel.notes);
    case _More.manage:
      return openRoomPanel(context, RoomPanel.people, scrollToManage: true);
    case _More.share:
      return controller.toggleScreenShare();
    case _More.switchCamera:
      return controller.switchCamera();
    case null:
      return;
  }
}

typedef _MoreState = ({
  bool manager,
  bool canShare,
  bool screen,
  bool camera,
  bool speakerOn,
  LayoutMode layout,
  int waiting,
  int unread,
});

class _MoreList extends ConsumerWidget {
  const _MoreList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final controller = MeetingRoomScope.of(context).controller;
    final _MoreState s = ref.watch(meetingRoomStoreProvider.select((x) => (
          manager: isManagerRoom(x.myRole),
          canShare: canShareScreen(x.myRole, x.settings),
          screen: x.screen,
          camera: x.camera,
          speakerOn: x.speakerOn,
          layout: x.layout,
          waiting: x.lobby.length,
          unread: x.unreadChat,
        )));
    void pick(_More m) => Navigator.of(context).pop(m);
    final muted = TextStyle(fontSize: 12, color: AppTheme.mutedText(context));
    return Column(mainAxisSize: MainAxisSize.min, children: [
      ListTile(
        leading: const Icon(Icons.group_rounded),
        title: Text(l.meetingPeople),
        subtitle: s.manager && s.waiting > 0
            ? Text(l.meetingLobbyWaiting(s.waiting), style: muted)
            : null,
        onTap: () => pick(_More.people),
      ),
      ListTile(
        leading: const Icon(Icons.chat_bubble_outline_rounded),
        title: Text(l.meetingChat),
        subtitle: s.unread > 0
            ? Text(l.meetingChatUnread(s.unread), style: muted)
            : null,
        onTap: () => pick(_More.chat),
      ),
      ListTile(
        leading: const Icon(Icons.edit_note_rounded),
        title: Text(l.meetingNotes),
        onTap: () => pick(_More.notes),
      ),
      if (controller.supportsScreenShare)
        ListTile(
          leading: Icon(s.screen
              ? Icons.stop_screen_share_rounded
              : Icons.screen_share_rounded),
          title: Text(s.screen ? l.meetingStopPresenting : l.meetingShareStart),
          subtitle: !s.screen && !s.canShare
              ? Text(l.meetingShareDisabled, style: muted)
              : null,
          enabled: s.screen || s.canShare,
          onTap: () => pick(_More.share),
        ),
      if (s.camera)
        ListTile(
          leading: const Icon(Icons.cameraswitch_rounded),
          title: Text(l.meetingSwitchCamera),
          onTap: () => pick(_More.switchCamera),
        ),
      SwitchListTile(
        secondary: const Icon(Icons.volume_up_rounded),
        title: Text(l.meetingSpeakerOn),
        value: s.speakerOn,
        onChanged: (on) => unawaited(controller.setSpeaker(on)),
      ),
      _LayoutRow(layout: s.layout, onChanged: controller.setLayout),
      if (s.manager)
        ListTile(
          leading: const Icon(Icons.admin_panel_settings_rounded),
          title: Text(l.meetingManageTitle),
          onTap: () => pick(_More.manage),
        ),
    ]);
  }
}

/// Grid / Speaker as a radio group (web: a radio menu) — wraps at any text
/// size, unlike a segmented control next to the label.
class _LayoutRow extends StatelessWidget {
  const _LayoutRow({required this.layout, required this.onChanged});

  final LayoutMode layout;
  final ValueChanged<LayoutMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final muted = TextStyle(fontSize: 12, color: AppTheme.mutedText(context));
    return RadioGroup<LayoutMode>(
      groupValue: layout,
      onChanged: (v) {
        if (v != null) onChanged(v);
      },
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Semantics(
              header: true, child: Text(l.meetingLayout, style: muted)),
        ),
        RadioListTile<LayoutMode>(
          value: LayoutMode.grid,
          secondary: const Icon(Icons.grid_view_rounded),
          title: Text(l.meetingLayoutGrid),
        ),
        RadioListTile<LayoutMode>(
          value: LayoutMode.spotlight,
          secondary: const Icon(Icons.person_pin_rounded),
          title: Text(l.meetingLayoutSpotlight),
        ),
      ]),
    );
  }
}
