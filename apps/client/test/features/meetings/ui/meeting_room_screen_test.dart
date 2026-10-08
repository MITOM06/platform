import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/ui/room/meeting_session_view.dart';
import 'package:platform_client/features/meetings/state/active_room.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/state/media_preview.dart';
import 'package:platform_client/features/meetings/state/meeting_room_deps.dart';
import 'package:platform_client/features/meetings/state/meeting_room_providers.dart';
import 'package:platform_client/features/meetings/state/meetings_store.dart';
import 'package:platform_client/features/meetings/ui/room/meeting_room_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../state/fake_meetings_api.dart';
import '../state/fake_realtime.dart';
import '../state/fake_room_session.dart';
import 'meeting_test_harness.dart';
import 'room_test_harness.dart';

class CodeApi extends FakeMeetingsApi {
  CodeApi(super.base);

  @override
  Future<Meeting> byCode(String code) async => base;
}

class Env {
  Env(Meeting m) : api = CodeApi(m);

  final CodeApi api;
  final rt = FakeRealtime();
  final session = FakeRoomSession();
  final frames = StreamController<Map<String, dynamic>>.broadcast();
  final connections = StreamController<void>.broadcast();
  final awake = <bool>[];
  int released = 0;
}

/// Another meeting's room that is open (QA P2-1).
class OtherRoom implements LiveMeetingRoom {
  OtherRoom(this.meetingId);
  @override
  final String meetingId;
  int left = 0;
  @override
  bool get isLive => true;
  @override
  void leave() => left++;
  @override
  void handle(MeetingEvent e) {}
}

Future<void> joinAsAttendee(WidgetTester tester, Env env) async {
  env.api.joins.add(const MeetingJoined(
      url: 'wss://rtc', token: 'tok', role: MeetingRoomRole.attendee));
  await tester.tap(find.text(l10nOf(tester).meetingJoinNow));
  await tester.pumpAndSettle();
}

Future<Env> pumpScreen(WidgetTester tester,
    {String code = 'abc-defg-hjk',
    Meeting? meeting,
    bool stacked = false}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final env = Env(meeting ?? roomMeeting());
  addTearDown(env.frames.close);
  addTearDown(env.connections.close);
  final deps = MeetingRoomDeps(
    api: env.api,
    cache: MemoryMeetingsCache(),
    realtime: env.rt,
    createSession: () => env.session,
    now: DateTime.now,
    newClientId: () => 'c-abc',
    notify: (_, __) {},
  );
  await pumpMeetingWidget(
      tester, stacked ? const Text('home') : MeetingRoomScreen(rawCode: code),
      wrapInScaffold: false,
      meetRoute: stacked ? (c) => MeetingRoomScreen(rawCode: c) : null,
      overrides: [
        meetingBackgroundReleaseProvider
            .overrideWithValue(() => env.released++),
        sharedPreferencesProvider.overrideWithValue(prefs),
        meetingsRepositoryProvider.overrideWithValue(env.api),
        meetingRoomDepsProvider.overrideWithValue(deps),
        meetingRoomStreamsProvider.overrideWithValue(MeetingRoomStreams(
            topicFrames: env.frames.stream,
            connections: env.connections.stream)),
        meetingKeepAwakeProvider.overrideWithValue(env.awake.add),
        mediaPreviewFactoryProvider.overrideWithValue(FakePreview.new),
        inAnyCallProvider.overrideWithValue(false),
        stompConnectedProvider.overrideWith((ref) => Stream.value(true)),
      ]);
  return env;
}

void main() {
  testWidgets('pre-join → room → leave, with the topic and keep-awake',
      (tester) async {
    final env = await pumpScreen(tester);
    final l = l10nOf(tester);
    expect(find.text(l.meetingJoinNow), findsOneWidget);
    env.api.joins.add(const MeetingJoined(
        url: 'wss://rtc', token: 'tok', role: MeetingRoomRole.attendee));
    await tester.tap(find.text(l.meetingJoinNow));
    await tester.pumpAndSettle();
    expect(find.byTooltip(l.meetingLeave), findsOneWidget);
    expect(env.rt.topics, ['sub:m1']);
    expect(env.awake.last, true);

    await tester.tap(find.byTooltip(l.meetingMore));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.meetingPeople));
    await tester.pumpAndSettle();
    expect(find.text(l.meetingPeopleTitle), findsOneWidget);
    expect(find.text(l.meetingSectionInMeeting(0)), findsOneWidget);
    Navigator.of(tester.element(find.text(l.meetingPeopleTitle))).pop();
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip(l.meetingLeave));
    await tester.pumpAndSettle();
    expect(find.text(l.meetingLeftTitle), findsOneWidget);
    expect(find.text(l.meetingRejoin), findsOneWidget);
    expect(env.rt.topics, ['sub:m1', 'unsub:m1']);
    expect(env.awake.last, false);
  });

  testWidgets('the meeting ending on the topic opens its details',
      (tester) async {
    final env = await pumpScreen(tester);
    final l = l10nOf(tester);
    env.api.joins.add(const MeetingJoined(
        url: 'wss://rtc', token: 'tok', role: MeetingRoomRole.attendee));
    await tester.tap(find.text(l.meetingJoinNow));
    await tester.pumpAndSettle();
    env.frames.add({'event': 'meet.ended', 'meetingId': 'm1'});
    await tester.pumpAndSettle();
    expect(find.text('/meetings/m1'), findsOneWidget);
  });

  testWidgets('a bad code is "not found"', (tester) async {
    await pumpScreen(tester, code: 'nope');
    expect(find.text(l10nOf(tester).meetingNotFoundTitle), findsOneWidget);
  });

  testWidgets('an ended meeting opens its details instead', (tester) async {
    final m = roomMeeting();
    await pumpScreen(tester,
        meeting: Meeting(
            id: m.id,
            code: m.code,
            host: m.host,
            status: MeetingStatus.ended,
            viewerRole: m.viewerRole,
            createdAt: m.createdAt));
    expect(find.text('/meetings/m1'), findsOneWidget);
  });

  testWidgets(
      'a guest waits off the topic, and cancelling leaves the waiting room',
      (tester) async {
    final env = await pumpScreen(tester,
        meeting: roomMeeting(viewerRole: MeetingViewerRole.guest));
    final l = l10nOf(tester);
    env.api.joins.add(const MeetingWaiting());
    await tester.tap(find.text(l.meetingAskToJoin));
    await tester.pump();
    await tester.pump();
    expect(find.text(l.meetingWaitingTitle), findsOneWidget);
    expect(env.rt.topics, isEmpty);
    await tester.tap(find.text(l.meetingWaitingCancel));
    await tester.pumpAndSettle();
    expect(env.api.leaveLobbyCalls, 1);
    expect(find.text(l.meetingAskToJoin), findsOneWidget);
  });

  testWidgets('opening a room leaves another meeting\'s open room (QA P2-1)',
      (tester) async {
    final other = OtherRoom('m9');
    setActiveMeetingRoom(other);
    addTearDown(() => setActiveMeetingRoom(null));
    await pumpScreen(tester);
    expect(other.left, 1);
    expect(find.text(l10nOf(tester).meetingJoinNow), findsOneWidget);
  });

  testWidgets('a second screen for the open meeting goes back to it (QA P2-1)',
      (tester) async {
    final env = await pumpScreen(tester, stacked: true);
    final router = GoRouter.of(tester.element(find.text('home')));
    unawaited(router.push('/meet/abc-defg-hjk'));
    await tester.pumpAndSettle();
    await joinAsAttendee(tester, env);
    expect(env.session.connects, hasLength(1));
    unawaited(router.push('/meet/abc-defg-hjk'));
    await tester.pumpAndSettle();
    expect(find.byType(MeetingSessionView), findsOneWidget);
    // Still in the same live room, nothing reset or reconnected.
    expect(find.byTooltip(l10nOf(tester).meetingLeave), findsOneWidget);
    expect(env.session.connects, hasLength(1));
    expect(env.session.disconnects, 0);
  });

  testWidgets('being removed closes the open chat sheet (QA P2-2)',
      (tester) async {
    final env = await pumpScreen(tester);
    await joinAsAttendee(tester, env);
    final l = l10nOf(tester);
    await tester.tap(find.byTooltip(l.meetingMore));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.meetingChat));
    await tester.pumpAndSettle();
    expect(find.text(l.meetingChatTitle), findsOneWidget);
    activeMeetingRoom()!.handle(const RemovedEvent(meetingId: 'm1'));
    await tester.pumpAndSettle();
    expect(find.text(l.meetingChatTitle), findsNothing);
    expect(find.text(l.meetingRemovedTitle), findsOneWidget);
  });

  testWidgets('removed while in the background lets STOMP go (QA P3-2)',
      (tester) async {
    final env = await pumpScreen(tester);
    await joinAsAttendee(tester, env);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    addTearDown(() => tester.binding
        .handleAppLifecycleStateChanged(AppLifecycleState.resumed));
    expect(env.released, 0);
    activeMeetingRoom()!.handle(const RemovedEvent(meetingId: 'm1'));
    await tester.pump();
    expect(env.released, 1);
  });
}
