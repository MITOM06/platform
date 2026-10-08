import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/state/meeting_room_deps.dart';
import 'package:platform_client/features/meetings/state/meeting_room_realtime.dart';

class _Rt implements MeetingRealtime {
  final log = <String>[];
  @override
  bool get isConnected => true;
  @override
  void publish(String d, Map<String, Object?> b) {}
  @override
  void subscribeTopic(String id) => log.add('sub:$id');
  @override
  void unsubscribeTopic(String id) => log.add('unsub:$id');
}

class _Target implements RoomRealtimeTarget {
  final events = <MeetingEvent>[];
  var resyncs = 0;
  @override
  void onTopicEvent(MeetingEvent e) => events.add(e);
  @override
  Future<void> onRealtimeReconnected() async => resyncs++;
}

Future<void> settle() => Future<void>.delayed(Duration.zero);

void main() {
  late _Rt rt;
  late _Target target;
  late StreamController<Map<String, dynamic>> frames;
  late StreamController<void> connections;
  late MeetingRoomRealtime b;

  setUp(() {
    rt = _Rt();
    target = _Target();
    frames = StreamController.broadcast();
    connections = StreamController.broadcast();
    b = MeetingRoomRealtime(
        meetingId: 'm1',
        target: target,
        realtime: rt,
        topicFrames: frames.stream,
        connections: connections.stream);
  });
  tearDown(() => b.dispose());

  test('subscribes only while connecting / in the room — never while waiting', () {
    b.onPhase(RoomPhase.prejoin);
    b.onPhase(RoomPhase.waiting);
    expect(rt.log, isEmpty);
    b.onPhase(RoomPhase.connecting);
    b.onPhase(RoomPhase.inRoom);
    expect(rt.log, ['sub:m1']);
    b.onPhase(RoomPhase.left);
    expect(rt.log, ['sub:m1', 'unsub:m1']);
  });

  test('forwards only this meeting’s parsed topic events', () async {
    b.onPhase(RoomPhase.inRoom);
    frames.add({'event': 'meet.ended', 'meetingId': 'm1'});
    frames.add({'event': 'meet.ended', 'meetingId': 'other'});
    frames.add({'junk': true});
    await settle();
    expect(target.events, hasLength(1));
    expect(target.events.single, isA<EndedEvent>());
  });

  test('a STOMP comeback resyncs the room, and re-asks from the lobby', () async {
    b.onPhase(RoomPhase.inRoom);
    connections.add(null);
    await settle();
    expect(target.resyncs, 1);
    b.onPhase(RoomPhase.waiting);
    connections.add(null);
    await settle();
    expect(target.resyncs, 2);
    b.onPhase(RoomPhase.prejoin);
    connections.add(null);
    await settle();
    expect(target.resyncs, 2);
  });

  test('dispose unsubscribes and stops listening', () async {
    b.onPhase(RoomPhase.inRoom);
    b.dispose();
    expect(rt.log.last, 'unsub:m1');
    frames.add({'event': 'meet.ended', 'meetingId': 'm1'});
    await settle();
    expect(target.events, isEmpty);
  });
}
