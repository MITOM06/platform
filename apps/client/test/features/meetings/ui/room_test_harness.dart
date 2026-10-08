import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/core/theme/app_theme.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/device_prefs.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/state/media_preview.dart';
import 'package:platform_client/features/meetings/state/meeting_room_controller.dart';
import 'package:platform_client/features/meetings/state/meeting_room_deps.dart';
import 'package:platform_client/features/meetings/state/meeting_room_providers.dart';
import 'package:platform_client/features/meetings/state/meeting_room_state.dart';
import 'package:platform_client/features/meetings/state/meetings_store.dart';
import 'package:platform_client/features/meetings/ui/room/meeting_room_scope.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../state/fake_meetings_api.dart';
import '../state/fake_realtime.dart';
import '../state/fake_room_session.dart';
import 'meeting_test_harness.dart';

/// A [MediaPreview] without plugins: records what the pre-join asked for.
class FakePreview extends MediaPreview {
  FakePreview({this.connectsSoFar});

  /// How many LiveKit connects had happened when [release] ran.
  final int Function()? connectsSoFar;
  bool _mic = true, _camera = true, _front = true;
  DevicePrefs? started;
  bool released = false;
  int? connectsAtRelease;
  int flips = 0;
  @override
  MediaPreviewError? error;

  @override
  bool get mic => _mic;
  @override
  bool get camera => _camera;
  @override
  bool get frontCamera => _front;
  @override
  MediaStream? get stream => null;

  @override
  void start(DevicePrefs prefs) {
    started = prefs;
    _mic = prefs.micOn;
    _camera = prefs.camOn;
    _front = prefs.frontCamera;
    notifyListeners();
  }

  @override
  void setMic(bool on) {
    _mic = on;
    notifyListeners();
  }

  @override
  void setCamera(bool on) {
    _camera = on;
    notifyListeners();
  }

  @override
  void flipCamera() {
    flips++;
    _front = !_front;
    notifyListeners();
  }

  @override
  void release() {
    released = true;
    connectsAtRelease ??= connectsSoFar?.call();
  }
}

Meeting roomMeeting({
  MeetingViewerRole viewerRole = MeetingViewerRole.invited,
  MeetingSettings settings = MeetingSettings.defaults,
  String? title = 'Weekly sync',
  DateTime? scheduledStart,
}) =>
    Meeting(
        id: 'm1',
        code: 'abc-defg-hjk',
        title: title,
        host: const MeetingPerson(userId: 'h', displayName: 'Lan'),
        status: MeetingStatus.live,
        settings: settings,
        scheduledStart: scheduledStart,
        viewerRole: viewerRole,
        createdAt: DateTime.utc(2026, 10, 8));

RtcPeer fakePeer(String id, String name, {bool micMuted = false}) =>
    RtcPeer(identity: id, name: name)..micMuted = micMuted;

MeetingViewerRole _viewerOf(MeetingRoomRole r) => switch (r) {
      MeetingRoomRole.host => MeetingViewerRole.host,
      MeetingRoomRole.cohost => MeetingViewerRole.cohost,
      _ => MeetingViewerRole.invited,
    };

class RoomHarness {
  RoomHarness(this.container, this.controller, this.session, this.api, this.rt,
      this.preview, this.notices, this.connection);

  final ProviderContainer container;
  final MeetingRoomController controller;
  final FakeRoomSession session;
  final FakeMeetingsApi api;
  final FakeRealtime rt;
  final FakePreview preview;
  final List<(NoticeLevel, MeetingNotice)> notices;
  final StreamController<bool> connection;

  RoomStore get store => container.read(meetingRoomStoreProvider.notifier);
  MeetingRoomState get state => store.value;

  /// STOMP up / down (banner, composer, hand button).
  void setRealtime(bool on) {
    rt.connected = on;
    connection.add(on);
  }

  void peers(List<RtcPeer> list) {
    session.fakePeers = list;
    session.onPeersChanged?.call(list);
  }
}

/// Builds a room controller over fakes, takes it to [phase] (prejoin or
/// inRoom) and pumps [child] inside its [MeetingRoomScope], signed in as `me`
/// ("Me").
Future<RoomHarness> pumpRoom(
  WidgetTester tester, {
  required Widget child,
  MeetingRoomRole role = MeetingRoomRole.attendee,
  MeetingViewerRole? viewerRole,
  MeetingSettings settings = MeetingSettings.defaults,
  List<RtcPeer> peers = const [],
  RoomPhase phase = RoomPhase.inRoom,
  bool inCall = false,
  DateTime Function()? now,
  List<Override> overrides = const [],
  Locale locale = const Locale('en'),
  bool dark = false,
  bool settle = true,
}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final session = FakeRoomSession();
  final meeting = roomMeeting(
      viewerRole: viewerRole ?? _viewerOf(role), settings: settings);
  final api = FakeMeetingsApi(meeting);
  final rt = FakeRealtime();
  final preview = FakePreview(connectsSoFar: () => session.connects.length);
  final notices = <(NoticeLevel, MeetingNotice)>[];
  final connection = StreamController<bool>.broadcast();
  final deps = MeetingRoomDeps(
    api: api,
    cache: MemoryMeetingsCache(),
    realtime: rt,
    createSession: () => session,
    now: now ?? DateTime.now,
    newClientId: () => 'c-abc',
    notify: (level, n) => notices.add((level, n)),
  );
  final container = ProviderContainer(overrides: [
    authNotifierProvider.overrideWith(HarnessAuth.new),
    sharedPreferencesProvider.overrideWithValue(prefs),
    meetingsRepositoryProvider.overrideWithValue(api),
    meetingRoomDepsProvider.overrideWithValue(deps),
    mediaPreviewFactoryProvider.overrideWithValue(() => preview),
    inAnyCallProvider.overrideWithValue(inCall),
    meetingKeepAwakeProvider.overrideWithValue((_) {}),
    stompConnectedProvider.overrideWith((ref) async* {
      yield rt.connected;
      yield* connection.stream;
    }),
    ...overrides,
  ]);
  addTearDown(container.dispose);
  addTearDown(connection.close);
  final controller = MeetingRoomController(
      meeting: meeting,
      myId: 'me',
      deps: deps,
      store: container.read(meetingRoomStoreProvider.notifier))
    ..activate();
  addTearDown(controller.dispose);
  if (phase == RoomPhase.inRoom) {
    api.joins.add(MeetingJoined(url: 'wss://rtc', token: 'tok', role: role));
    await controller.join(const JoinMedia(mic: true, camera: false));
  }
  final h = RoomHarness(
      container, controller, session, api, rt, preview, notices, connection);
  if (peers.isNotEmpty) h.peers(peers);

  final router = GoRouter(routes: [
    GoRoute(
        path: '/',
        builder: (_, __) => MeetingRoomScope(
            controller: controller,
            meeting: meeting,
            myId: 'me',
            myName: 'Me',
            child: child)),
    GoRoute(path: '/meet/:code', builder: (_, s) => Text(s.uri.path)),
    GoRoute(path: '/meetings/:id', builder: (_, s) => Text(s.uri.path)),
    GoRoute(path: '/meetings', builder: (_, s) => Text(s.uri.path)),
  ]);
  await tester.pumpWidget(UncontrolledProviderScope(
    container: container,
    child: MaterialApp.router(
      routerConfig: router,
      locale: locale,
      theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  ));
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump(const Duration(milliseconds: 500));
  }
  return h;
}

AppLocalizations roomL10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(MeetingRoomScope)));
