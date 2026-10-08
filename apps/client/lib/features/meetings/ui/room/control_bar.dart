import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/permissions.dart';
import '../../state/meeting_room_providers.dart';
import 'leave_sheet.dart';
import 'meeting_room_scope.dart';
import 'reaction_picker.dart';
import 'room_controls.dart';
import 'room_more_sheet.dart';

typedef _BarState = ({
  bool mic,
  bool camera,
  bool raised,
  bool manager,
  int unread,
  int waiting,
});

/// Bottom bar of the room: mic · camera · hand · reaction · more · leave —
/// mirror of web `ControlBar` (phone layout; People / Chat / Notes / Present
/// live in More). Six 48 dp buttons fit at 320 dp.
class ControlBar extends ConsumerWidget {
  const ControlBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final scope = MeetingRoomScope.of(context);
    final s = ref.watch(meetingRoomStoreProvider.select((x) => (
          mic: x.mic,
          camera: x.camera,
          raised: x.hands.any((h) => h.userId == scope.myId),
          manager: isManagerRoom(x.myRole),
          unread: x.unreadChat,
          waiting: x.lobby.length,
        )));
    final online = ref.watch(stompConnectedProvider).valueOrNull ?? true;
    final attention = [
      if (s.manager && s.waiting > 0) l.meetingLobbyWaiting(s.waiting),
      if (s.unread > 0) l.meetingChatUnread(s.unread),
    ];
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(top: BorderSide(color: AppTheme.hairline(context))),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 72,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: _buttons(context, s, online, attention),
          ),
        ),
      ),
    );
  }

  List<Widget> _buttons(
      BuildContext context, _BarState s, bool online, List<String> attention) {
    final l = context.l10n;
    final controller = MeetingRoomScope.read(context).controller;
    return [
      RoomRoundButton(
        icon: s.mic ? Icons.mic_rounded : Icons.mic_off_rounded,
        tooltip: s.mic ? l.meetingMicOff : l.meetingMicOn,
        toggled: s.mic,
        danger: !s.mic,
        onPressed: () => unawaited(controller.toggleMic()),
      ),
      RoomRoundButton(
        icon: s.camera ? Icons.videocam_rounded : Icons.videocam_off_rounded,
        tooltip: s.camera ? l.meetingCamOff : l.meetingCamOn,
        toggled: s.camera,
        danger: !s.camera,
        onPressed: () => unawaited(controller.toggleCamera()),
      ),
      RoomRoundButton(
        icon: Icons.back_hand_rounded,
        tooltip: s.raised ? l.meetingLowerHand : l.meetingRaiseHand,
        toggled: s.raised,
        active: s.raised,
        onPressed: online ? () => controller.setHand(!s.raised) : null,
      ),
      RoomRoundButton(
        icon: Icons.add_reaction_rounded,
        tooltip: l.meetingReactions,
        onPressed: () => unawaited(showReactionPicker(context)),
      ),
      Semantics(
        hint: attention.isEmpty ? null : attention.join('. '),
        child: RoomRoundButton(
          icon: Icons.more_horiz_rounded,
          tooltip: l.meetingMore,
          dot: attention.isNotEmpty,
          onPressed: () => unawaited(showRoomMoreSheet(context)),
        ),
      ),
      RoomRoundButton(
        icon: Icons.call_end_rounded,
        tooltip: l.meetingLeave,
        danger: true,
        onPressed: () => s.manager
            ? unawaited(
                showLeaveSheet(context, controller: controller, manager: true))
            : controller.leave(),
      ),
    ];
  }
}
