import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../domain/permissions.dart';
import '../../state/meeting_room_providers.dart';
import '../../state/meeting_room_state.dart';
import 'control_bar.dart';
import 'meeting_room_scope.dart';
import 'meeting_stage.dart';
import 'reaction_overlay.dart';
import 'room_banners.dart';
import 'room_controls.dart';
import 'room_panels.dart';

/// The room itself: stage + banners + reactions over it, the control bar
/// below — mirror of web `MeetingRoom`. Remote audio plays natively (no
/// element per person, unlike the web's `RemoteAudio`).
class MeetingRoomView extends ConsumerWidget {
  const MeetingRoomView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    // Managers: a banner when more people start waiting while People is shut.
    ref.listen(meetingRoomStoreProvider.select((s) => s.lobby.length),
        (prev, count) {
      final s = ref.read(meetingRoomStoreProvider);
      if (prev == null || count <= prev) return;
      if (s.panel == RoomPanel.people || !isManagerRoom(s.myRole)) return;
      showInAppNotification(l.meetingPeopleTitle, l.meetingLobbyWaiting(count),
          onTap: () {
        if (context.mounted) openRoomPanel(context, RoomPanel.people);
      });
    });
    final title = MeetingRoomScope.of(context).meeting.title?.trim();
    return Scaffold(
      backgroundColor: kStageBackground,
      body: SafeArea(
        bottom: false,
        child: Semantics(
          container: true,
          label: title == null || title.isEmpty ? l.meetingUntitled : title,
          child: const Stack(children: [
            Positioned.fill(child: MeetingStage()),
            Positioned.fill(child: IgnorePointer(child: ReactionOverlay())),
            Positioned(top: 8, left: 16, right: 16, child: RoomBanners()),
          ]),
        ),
      ),
      bottomNavigationBar: const ControlBar(),
    );
  }
}
