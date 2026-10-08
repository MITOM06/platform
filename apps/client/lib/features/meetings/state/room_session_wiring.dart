// LiveKit session callbacks → the room store — mirror of web
// `lib/meetings/room-session.ts` (`wireRoomSession`, `peersPatch`).

import '../../../core/rtc/rtc_session.dart';
import 'meeting_room_state.dart';

/// Copies peers (the session mutates them in place) and keeps the last remote
/// speaker sticky.
MeetingRoomState peersPatch(MeetingRoomState s, List<RtcPeer> peers) {
  String? speaking;
  for (final p in peers) {
    if (p.speaking) {
      speaking = p.identity;
      break;
    }
  }
  final prev = s.activeSpeakerId;
  final stillHere =
      prev != null && peers.any((p) => p.identity == prev) ? prev : null;
  return s.copyWith(
    peers: List.unmodifiable(peers.map(MeetingPeer.of)),
    activeSpeakerId: speaking ?? stillHere,
  );
}

/// [isCurrent]: false once the controller moved on to another session (late
/// callbacks are dropped). [onClosed]: the room went away on its own (never
/// after our own disconnect).
void wireRoomSession(
  MeetingRtcSession session,
  RoomStore store, {
  required bool Function() isCurrent,
  required void Function(String topic, List<int> payload, String? from) onData,
  required void Function(RtcEnd reason) onClosed,
}) {
  session.onLocalStream = (stream) {
    if (isCurrent()) {
      store.update((s) => s.copyWith(
          localStream: stream, localScreen: session.localScreenStream));
    }
  };
  session.onPeersChanged = (peers) {
    if (isCurrent()) store.update((s) => peersPatch(s, peers));
  };
  session.onReconnecting = (on) {
    if (isCurrent()) store.update((s) => s.copyWith(reconnecting: on));
  };
  session.onLocalPoorConnection = (poor) {
    if (isCurrent()) store.update((s) => s.copyWith(poorConnection: poor));
  };
  session.onLocalMediaChanged = (m) {
    if (!isCurrent()) return;
    store.update((s) => s.copyWith(
          mic: m.mic,
          camera: m.camera,
          screen: m.screen,
          localStream: session.localStream,
          localScreen: session.localScreenStream,
        ));
  };
  session.onData = (topic, payload, from) {
    if (isCurrent()) onData(topic, payload, from);
  };
  session.onDisconnected = (reason) {
    if (!isCurrent()) return;
    store.update((s) => s.copyWith(reconnecting: false, screen: false));
    onClosed(reason);
  };
}
