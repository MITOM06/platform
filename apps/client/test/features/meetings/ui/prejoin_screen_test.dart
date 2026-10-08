import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/widgets/pon_widgets.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/state/media_preview.dart';
import 'package:platform_client/features/meetings/ui/room/prejoin_screen.dart';

import 'room_test_harness.dart';

Future<RoomHarness> pumpPrejoin(WidgetTester tester,
        {MeetingViewerRole viewerRole = MeetingViewerRole.invited,
        MeetingSettings settings = MeetingSettings.defaults,
        bool inCall = false}) =>
    pumpRoom(tester,
        child: const PrejoinScreen(busy: false),
        phase: RoomPhase.prejoin,
        viewerRole: viewerRole,
        settings: settings,
        inCall: inCall);

void main() {
  testWidgets('a guest facing a waiting room asks to join', (tester) async {
    await pumpPrejoin(tester, viewerRole: MeetingViewerRole.guest);
    final l = roomL10n(tester);
    expect(find.text(l.meetingAskToJoin), findsOneWidget);
    expect(find.text(l.meetingJoinNow), findsNothing);
  });

  testWidgets('an invited person joins now', (tester) async {
    await pumpPrejoin(tester);
    final l = roomL10n(tester);
    expect(find.text(l.meetingJoinNow), findsOneWidget);
    expect(find.text(l.meetingAskToJoin), findsNothing);
  });

  testWidgets('mute on entry starts an attendee muted and says so',
      (tester) async {
    final h = await pumpPrejoin(tester,
        settings: const MeetingSettings(muteOnEntry: true));
    final l = roomL10n(tester);
    expect(h.preview.started?.micOn, false);
    expect(find.byTooltip(l.meetingMicOn), findsOneWidget);
    expect(find.text(l.meetingPrejoinMuteOnEntry), findsOneWidget);
  });

  testWidgets('mute on entry does not apply to the host', (tester) async {
    final h = await pumpPrejoin(tester,
        viewerRole: MeetingViewerRole.host,
        settings: const MeetingSettings(muteOnEntry: true));
    final l = roomL10n(tester);
    expect(h.preview.started?.micOn, true);
    expect(find.byTooltip(l.meetingMicOff), findsOneWidget);
    expect(find.text(l.meetingPrejoinMuteOnEntry), findsNothing);
  });

  testWidgets('a running call blocks joining', (tester) async {
    await pumpPrejoin(tester, inCall: true);
    final l = roomL10n(tester);
    expect(find.text(l.meetingPrejoinInCall), findsOneWidget);
    expect(tester.widget<PonButton>(find.byType(PonButton)).onPressed, isNull);
  });

  testWidgets('joining releases the preview first, then joins with the toggles',
      (tester) async {
    final h = await pumpPrejoin(tester);
    final l = roomL10n(tester);
    await tester.tap(find.byTooltip(l.meetingCamOff));
    await tester.pump();
    h.api.joins.add(const MeetingJoined(
        url: 'wss://rtc', token: 'tok', role: MeetingRoomRole.attendee));
    await tester.tap(find.text(l.meetingJoinNow));
    await tester.pump();
    expect(h.preview.released, true);
    expect(h.preview.connectsAtRelease, 0);
    expect(h.session.connects, hasLength(1));
    final options = h.session.connects.single.$3;
    expect(options.audio, true);
    expect(options.video, false);
    expect(h.state.phase, RoomPhase.inRoom);
  });

  testWidgets('blocked media is explained and the toggles show it',
      (tester) async {
    final h = await pumpPrejoin(tester);
    h.preview.error = MediaPreviewError.blocked;
    h.preview.setMic(false);
    await tester.pump();
    expect(find.text(roomL10n(tester).meetingMediaBlocked), findsOneWidget);
  });

  testWidgets('fits 320 dp at 200 % text', (tester) async {
    tester.view.physicalSize = const Size(320 * 3, 640 * 3);
    tester.view.devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await pumpPrejoin(tester,
        settings: const MeetingSettings(muteOnEntry: true));
    expect(tester.takeException(), isNull);
    expect(
        find.byTooltip(roomL10n(tester).meetingSwitchCamera), findsOneWidget);
  });
}
