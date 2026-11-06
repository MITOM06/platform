import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/call_stt_service.dart';
import 'package:platform_client/features/meetings/domain/meeting_settings.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/state/meeting_room_state.dart';
import 'package:platform_client/features/meetings/state/meeting_transcriber.dart';
import 'package:platform_client/features/meetings/state/room_session_wiring.dart';

class _Stomp extends StompService {
  final sent = <({String destination, Map<String, dynamic> body})>[];
  @override
  void build() {}
  @override
  void sendRawMessage({required String destination, required String body}) =>
      sent.add((destination: destination, body: jsonDecode(body)));
}

class _Capture implements SpeechCapture {
  int starts = 0;
  int stops = 0;
  bool result = true;
  Completer<bool>? gate;
  void Function(String)? onFinal;
  @override
  bool get running => starts > stops;
  @override
  Future<bool> start(void Function(String text) onFinal,
      {void Function()? onBlocked}) async {
    starts++;
    this.onFinal = onFinal;
    return gate?.future ?? Future.value(result);
  }

  @override
  Future<void> stop() async => stops++;
}

void main() {
  late _Stomp stomp;
  late _Capture capture;
  late MeetingTranscriber t;
  setUp(() {
    stomp = _Stomp();
    capture = _Capture();
    t = MeetingTranscriber(stomp, capture);
  });

  Future<void> on() async {
    t.sync(meetingId: 'm1', active: true);
    await Future<void>.delayed(Duration.zero);
  }

  test('publishes final text to /app/meet.transcript while active', () async {
    await on();
    capture.onFinal!('hello team');
    expect(stomp.sent.single.destination, '/app/meet.transcript');
    expect(stomp.sent.single.body['meetingId'], 'm1');
    expect(stomp.sent.single.body['text'], 'hello team');
    expect(stomp.sent.single.body['ts'], isA<int>());
    expect(t.supported.value, true);
  });

  test('pause stops capture, drops late finals, resume restarts', () async {
    await on();
    t.setPaused(true);
    expect(capture.stops, 1);
    expect(t.paused.value, true);
    capture.onFinal!('late');
    expect(stomp.sent, isEmpty);
    t.setPaused(false);
    await Future<void>.delayed(Duration.zero);
    expect(capture.starts, 2);
    capture.onFinal!('back');
    expect(stomp.sent, hasLength(1));
  });

  test('inactive (AI off / mic off) stops and drops late finals', () async {
    await on();
    t.sync(meetingId: 'm1', active: false);
    expect(capture.stops, 1);
    capture.onFinal!('late');
    expect(stomp.sent, isEmpty);
    expect(capture.starts, 1);
  });

  test('repeated sync with same state does not restart', () async {
    await on();
    t.sync(meetingId: 'm1', active: true);
    expect(capture.starts, 1);
  });

  test('start refused: supported false, no throw, no restart loop', () async {
    capture.result = false;
    await on();
    expect(t.supported.value, false);
    t.sync(meetingId: 'm1', active: true);
    await Future<void>.delayed(Duration.zero);
    expect(capture.starts, 1);
  });

  test('stopped while start is pending: nothing published, not supported',
      () async {
    capture.gate = Completer<bool>();
    t.sync(meetingId: 'm1', active: true);
    t.sync(meetingId: 'm1', active: false);
    capture.gate!.complete(false);
    await Future<void>.delayed(Duration.zero);
    expect(t.supported.value, isNull);
  });

  test('leaving the room resets pause and support', () async {
    capture.result = false;
    await on();
    t.setPaused(true);
    t.sync(meetingId: null, active: false);
    expect(t.paused.value, false);
    expect(t.supported.value, isNull);
  });

  test('transcriberSyncArgs: in room + AI notes + mic on', () {
    const s = MeetingRoomState(
        phase: RoomPhase.inRoom,
        mic: true,
        settings: MeetingSettings(aiNotes: true));
    expect(transcriberSyncArgs(s, 'm1'), (meetingId: 'm1', active: true));
    expect(transcriberSyncArgs(s.copyWith(mic: false), 'm1').active, false);
    expect(
        transcriberSyncArgs(
                s.copyWith(settings: MeetingSettings.defaults), 'm1')
            .active,
        false);
    final out = transcriberSyncArgs(s.copyWith(phase: RoomPhase.left), 'm1');
    expect(out, (meetingId: null, active: false));
  });
}
