// `/topic/meeting/{id}` while the room is connecting / open, and the resync
// after STOMP comes back — mirror of web `lib/hooks/use-meeting-room-stomp.ts`
// (+ the "re-ask from the lobby" half of `use-lobby-exit.ts`).
//
// Never subscribed while waiting in the lobby (the server refuses that
// subscription). Subscribe first, read after: the STOMP registry
// re-subscribes the topic on every reconnect, then the controller re-reads
// the room to cover the gap in which events were missed.

import 'dart:async';

import '../domain/meeting_events.dart';
import '../domain/room_phase.dart';
import 'meeting_room_deps.dart';

abstract interface class RoomRealtimeTarget {
  void onTopicEvent(MeetingEvent e);
  Future<void> onRealtimeReconnected();
}

class MeetingRoomRealtime {
  MeetingRoomRealtime({
    required this.meetingId,
    required this.target,
    required this.realtime,
    required Stream<Map<String, dynamic>> topicFrames,
    required Stream<void> connections,
  }) {
    _frames = topicFrames.listen(_onFrame);
    _connections = connections.listen((_) => _onConnected());
  }

  final String meetingId;
  final RoomRealtimeTarget target;
  final MeetingRealtime realtime;
  late final StreamSubscription<Map<String, dynamic>> _frames;
  late final StreamSubscription<void> _connections;
  RoomPhase _phase = RoomPhase.loading;
  bool _subscribed = false;
  bool _disposed = false;

  /// Called on every phase change (the session view listens to the store).
  void onPhase(RoomPhase phase) {
    if (_disposed) return;
    _phase = phase;
    final live = phase == RoomPhase.connecting || phase == RoomPhase.inRoom;
    if (live && !_subscribed) {
      _subscribed = true;
      realtime.subscribeTopic(meetingId);
    } else if (!live && _subscribed) {
      _subscribed = false;
      realtime.unsubscribeTopic(meetingId);
    }
  }

  void _onFrame(Map<String, dynamic> frame) {
    if (_disposed || !_subscribed) return;
    final e = parseMeetingEvent(frame);
    if (e != null && e.meetingId == meetingId) target.onTopicEvent(e);
  }

  /// In the room: re-read what may have been missed. In the lobby there is no
  /// topic: a comeback must re-ask, or a `meet.admitted` sent while offline is
  /// lost and the guest waits forever.
  void _onConnected() {
    if (_disposed) return;
    if (_subscribed || _phase == RoomPhase.waiting) {
      unawaited(target.onRealtimeReconnected());
    }
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    unawaited(_frames.cancel());
    unawaited(_connections.cancel());
    if (_subscribed) {
      _subscribed = false;
      realtime.unsubscribeTopic(meetingId);
    }
  }
}
