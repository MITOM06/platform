import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/domain/stage_layout.dart';
import 'package:platform_client/features/meetings/ui/room/meeting_room_view.dart';

import 'meeting_test_harness.dart';
import 'room_test_harness.dart';

void main() {
  testWidgets(
      'shows me and the other person, and the mic button drives the controller',
      (tester) async {
    final room = await pumpRoom(tester,
        role: MeetingRoomRole.attendee,
        peers: [fakePeer('bob', 'Bob')],
        child: const MeetingRoomView());
    await tester.pump();
    final l = l10nOf(tester);
    expect(find.text(l.meetingNameWithYou('Me')), findsOneWidget);
    expect(find.text('Bob'), findsOneWidget);
    await tester.tap(find.byTooltip(l.meetingMicOff));
    await tester.pump();
    expect(room.session.micCalls, [false]);
    expect(find.byTooltip(l.meetingMicOn), findsOneWidget);
  });

  testWidgets('an attendee leaves with one button and sees no host controls',
      (tester) async {
    final room = await pumpRoom(tester,
        role: MeetingRoomRole.attendee, child: const MeetingRoomView());
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingMore));
    await tester.pumpAndSettle();
    expect(find.text(l.meetingManageTitle), findsNothing);
    Navigator.of(tester.element(find.text(l.meetingPeople))).pop();
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip(l.meetingLeave));
    await tester.pumpAndSettle();
    expect(room.store.value.phase, RoomPhase.left);
    expect(find.text(l.meetingEndForAll), findsNothing);
  });

  testWidgets('a host can end the meeting for everyone after confirming',
      (tester) async {
    final room = await pumpRoom(tester,
        role: MeetingRoomRole.host, child: const MeetingRoomView());
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingLeave));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.meetingEndForAll));
    await tester.pumpAndSettle();
    expect(find.text(l.meetingEndConfirmTitle), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, l.meetingEndForAll).last);
    await tester.pumpAndSettle();
    expect(room.api.endCalls, 1);
    expect(room.store.value.phase, RoomPhase.ended);
  });

  testWidgets('the hand button raises my hand over STOMP, and is off offline',
      (tester) async {
    final room = await pumpRoom(tester, child: const MeetingRoomView());
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingRaiseHand));
    expect(room.rt.sent.last.$1, '/app/meet.hand');
    expect(room.rt.sent.last.$2, {'meetingId': 'm1', 'raised': true});
    room.setRealtime(false);
    await tester.pump();
    await tester.pump();
    expect(find.text(l.meetingRealtimeOffline), findsOneWidget);
    final hand = tester.widget<IconButton>(find.ancestor(
        of: find.byTooltip(l.meetingRaiseHand),
        matching: find.byType(IconButton)));
    expect(hand.onPressed, isNull);
  });

  testWidgets('More switches the layout to the speaker view', (tester) async {
    final room = await pumpRoom(tester, child: const MeetingRoomView());
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingMore));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.meetingLayoutSpotlight));
    await tester.pumpAndSettle();
    expect(room.store.value.layout, LayoutMode.spotlight);
  });

  testWidgets('presenting is offered where the device can share',
      (tester) async {
    final room = await pumpRoom(tester, child: const MeetingRoomView());
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingMore));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.meetingShareStart));
    await tester.pumpAndSettle();
    expect(room.session.shareCalls, [true]);
    expect(room.store.value.screen, true);
  });

  testWidgets('a reaction is sent once and floats over the stage',
      (tester) async {
    final room = await pumpRoom(tester, child: const MeetingRoomView());
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingReactions));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('🎉'));
    await tester.pump();
    expect(room.session.sent, hasLength(1));
    expect(room.store.value.reactions.single.emoji, '🎉');
    room.controller.dispose(); // reaction timers
  });

  testWidgets('more than six people on a phone shows a "+N" tile',
      (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await pumpRoom(tester,
        peers: [for (var i = 1; i <= 7; i++) fakePeer('p$i', 'Person $i')],
        child: const MeetingRoomView());
    await tester.pump();
    final l = l10nOf(tester);
    // me + 4 people + "+3"
    expect(find.text(l.meetingOverflowTiles(3)), findsOneWidget);
  });
}
