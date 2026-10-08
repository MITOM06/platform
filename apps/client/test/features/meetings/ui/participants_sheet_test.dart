import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/ui/room/participants_sheet.dart';

import 'meeting_test_harness.dart';
import 'room_test_harness.dart';

const rawId = '64b0aaaaaaaaaaaaaaaaaaaa';
final t0 = DateTime.utc(2026, 10, 8, 9);

RosterEntry person(String id, String? name,
        [MeetingRoomRole role = MeetingRoomRole.attendee, int minute = 1]) =>
    RosterEntry(
        userId: id,
        displayName: name,
        role: role,
        joinedAt: t0.add(Duration(minutes: minute)));

Future<RoomHarness> pumpPeople(WidgetTester tester,
    {MeetingRoomRole role = MeetingRoomRole.host,
    List<RosterEntry> roster = const []}) async {
  final h = await pumpRoom(tester,
      role: role,
      peers: [fakePeer('bob', 'Bob')],
      child: const Scaffold(body: ParticipantsSheet()));
  h.controller.onTopicEvent(RosterEvent(meetingId: 'm1', participants: [
    person('me', 'Me', role, 0),
    person('bob', 'Bob'),
    ...roster,
  ]));
  await tester.pump();
  return h;
}

void main() {
  testWidgets('a host admits someone from the waiting room', (tester) async {
    final h = await pumpPeople(tester);
    h.controller.handle(const LobbyEvent(
        meetingId: 'm1',
        waiting: [LobbyEntry(userId: 'g', displayName: 'Guest')]));
    await tester.pump();
    final l = l10nOf(tester);
    expect(find.text(l.meetingSectionLobby(1)), findsOneWidget);
    await tester.tap(find.text(l.meetingAdmit));
    await tester.pump();
    await tester.pump();
    expect(h.api.admitted, ['g']);
    expect(find.text(l.meetingSectionLobby(1)), findsNothing);
  });

  testWidgets('the person menu mutes someone over STOMP', (tester) async {
    final h = await pumpPeople(tester);
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingPersonMenu('Bob')));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.meetingActionMuteMic));
    await tester.pumpAndSettle();
    expect(h.rt.sent.last.$1, '/app/meet.host');
    expect(h.rt.sent.last.$2,
        {'meetingId': 'm1', 'action': 'MUTE_MIC', 'targetId': 'bob'});
  });

  testWidgets('removing someone asks first', (tester) async {
    final h = await pumpPeople(tester);
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingPersonMenu('Bob')));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.meetingActionRemove));
    await tester.pumpAndSettle();
    expect(find.text(l.meetingRemoveConfirmTitle('Bob')), findsOneWidget);
    expect(h.rt.sent, isEmpty);
    await tester
        .tap(find.widgetWithText(TextButton, l.meetingActionRemove).last);
    await tester.pumpAndSettle();
    expect(h.rt.sent.last.$2['action'], 'REMOVE');
  });

  testWidgets('the lock switch waits for the server to confirm',
      (tester) async {
    final h = await pumpPeople(tester);
    final l = l10nOf(tester);
    final lockTile =
        find.widgetWithText(SwitchListTile, l.meetingSettingLocked);
    await tester.scrollUntilVisible(lockTile, 100);
    await tester.tap(lockTile);
    await tester.pump();
    expect(h.rt.sent.last.$2, {'meetingId': 'm1', 'action': 'LOCK'});
    expect(tester.widget<SwitchListTile>(lockTile).onChanged, isNull);
    h.controller.onSettings(const MeetingSettings(locked: true));
    await tester.pump();
    final tile = tester.widget<SwitchListTile>(lockTile);
    expect(tile.onChanged, isNotNull);
    expect(tile.value, true);
  });

  testWidgets('raised hands are listed earliest first', (tester) async {
    final h = await pumpPeople(tester);
    h.controller.onTopicEvent(HandsEvent(meetingId: 'm1', hands: [
      MeetingHand(userId: 'c', displayName: 'Chi', raisedAt: t0),
      MeetingHand(
          userId: 'a',
          displayName: 'An',
          raisedAt: t0.add(const Duration(seconds: 5))),
    ]));
    await tester.pump();
    final l = l10nOf(tester);
    expect(find.text(l.meetingSectionHands(2)), findsOneWidget);
    expect(tester.getTopLeft(find.text('Chi')).dy,
        lessThan(tester.getTopLeft(find.text('An')).dy));
    expect(find.text('1.'), findsOneWidget);
    expect(find.text('2.'), findsOneWidget);
  });

  testWidgets('an attendee sees no waiting room, menus or host controls',
      (tester) async {
    final h = await pumpPeople(tester, role: MeetingRoomRole.attendee);
    h.controller.handle(const LobbyEvent(
        meetingId: 'm1',
        waiting: [LobbyEntry(userId: 'g', displayName: 'Guest')]));
    await tester.pump();
    final l = l10nOf(tester);
    expect(find.text(l.meetingSectionLobby(1)), findsNothing);
    expect(find.byTooltip(l.meetingPersonMenu('Bob')), findsNothing);
    expect(find.text(l.meetingManageTitle), findsNothing);
  });

  testWidgets('a nameless person never shows their id', (tester) async {
    await pumpPeople(tester, roster: [person(rawId, null)]);
    final l = l10nOf(tester);
    expect(find.text(l.meetingParticipantFallback), findsOneWidget);
    expect(find.textContaining('64b0'), findsNothing);
  });

  testWidgets('everyone in the room is counted, me first', (tester) async {
    await pumpPeople(tester);
    final l = l10nOf(tester);
    expect(find.text(l.meetingSectionInMeeting(2)), findsOneWidget);
    expect(tester.getTopLeft(find.text(l.meetingNameWithYou('Me'))).dy,
        lessThan(tester.getTopLeft(find.text('Bob')).dy));
  });
}
