// Riverpod wiring of the meeting room: the one room store, the STOMP adapter,
// the controller's deps, "a call is running" and "STOMP is up".

import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../../core/rtc/livekit_session.dart';
import '../../../core/rtc/rtc_session.dart';
import '../../../core/rtc/screen_capture.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/utils/global_messenger.dart';
import '../../chat/data/stomp_service.dart';
import '../../chat/domain/group_call_controller.dart';
import '../../chat/domain/sfu_call_service.dart';
import '../../chat/domain/webrtc_service.dart';
import '../data/meetings_repository.dart';
import '../ui/meeting_text_l10n.dart';
import 'meeting_room_deps.dart';
import 'meeting_room_state.dart';
import 'meetings_store.dart';

/// One meeting room is open at a time; its controller writes here.
class MeetingRoomStoreNotifier extends Notifier<MeetingRoomState>
    implements RoomStore {
  @override
  MeetingRoomState build() => MeetingRoomState.initial;

  @override
  MeetingRoomState get value => state;

  @override
  void update(MeetingRoomState Function(MeetingRoomState s) fn) =>
      state = fn(state);

  @override
  void reset() => state = MeetingRoomState.initial;
}

/// keepAlive (a plain [NotifierProvider] is never auto-disposed). Widgets
/// read it with narrow `select`s.
final meetingRoomStoreProvider =
    NotifierProvider<MeetingRoomStoreNotifier, MeetingRoomState>(
        MeetingRoomStoreNotifier.new);

/// [MeetingRealtime] over the app's one STOMP client.
class StompMeetingRealtime implements MeetingRealtime {
  StompMeetingRealtime(this._stomp);

  final StompService _stomp;

  @override
  bool get isConnected => _stomp.isConnected;

  @override
  void publish(String destination, Map<String, Object?> body) =>
      _stomp.sendRawMessage(destination: destination, body: jsonEncode(body));

  @override
  void subscribeTopic(String meetingId) =>
      _stomp.subscribeMeetingTopic(meetingId);

  @override
  void unsubscribeTopic(String meetingId) =>
      _stomp.unsubscribeMeetingTopic(meetingId);
}

final meetingRealtimeProvider = Provider<MeetingRealtime>(
    (ref) => StompMeetingRealtime(ref.read(stompServiceProvider.notifier)));

final meetingRoomDepsProvider = Provider<MeetingRoomDeps>((ref) {
  return MeetingRoomDeps(
    api: ref.read(meetingsRepositoryProvider),
    cache: ref.read(meetingsStoreProvider.notifier),
    realtime: ref.read(meetingRealtimeProvider),
    createSession: () => LiveKitSession(capture: platformScreenCapture()),
    now: DateTime.now,
    newClientId: newMeetingClientId,
    notify: (level, notice) {
      final text = meetingText(appL10n(), notice);
      if (level == NoticeLevel.error) {
        showErrorSnackBar(text);
      } else {
        showInfoSnackBar(text);
      }
    },
    screenShareNotice: () {
      final l = appL10n();
      return ScreenShareNotice(
          title: l.meetingShareNotifTitle, body: l.meetingShareNotifBody);
    },
  );
});

/// A call (1-1 or group) is in progress — pre-join blocks joining (web
/// `prejoinInCall`). Group calls are watched; the 1-1 engines expose no
/// observable flag, so they are read when this re-evaluates (the call
/// screen covers the app while a 1-1 call runs anyway).
final inAnyCallProvider = Provider<bool>((ref) {
  final group = ref.watch(groupCallControllerProvider).isActive;
  return group ||
      ref.read(webRtcServiceProvider).isActive ||
      ref.read(sfuCallServiceProvider).isActive;
});

/// STOMP is up (the room's "realtime offline" banner; web
/// `useStompConnected`). First value = the current state.
final stompConnectedProvider = StreamProvider<bool>((ref) async* {
  final stomp = ref.read(stompServiceProvider.notifier);
  yield stomp.isConnected;
  yield* stomp.connectionChanges;
});

/// The STOMP streams the room binding listens to (overridden in widget tests).
class MeetingRoomStreams {
  const MeetingRoomStreams(
      {required this.topicFrames, required this.connections});

  final Stream<Map<String, dynamic>> topicFrames;
  final Stream<void> connections;
}

final meetingRoomStreamsProvider = Provider<MeetingRoomStreams>((ref) {
  final stomp = ref.read(stompServiceProvider.notifier);
  return MeetingRoomStreams(
      topicFrames: stomp.meetingTopic, connections: stomp.connections);
});

/// Keep the screen on while in the room (best-effort; no-op in tests).
final meetingKeepAwakeProvider = Provider<void Function(bool on)>(
  (_) => (on) => unawaited(
      (on ? WakelockPlus.enable() : WakelockPlus.disable())
          .catchError((Object _) {})),
);
