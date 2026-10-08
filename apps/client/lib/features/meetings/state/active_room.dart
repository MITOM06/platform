import '../domain/meeting_queue.dart';

export '../domain/meeting_queue.dart' show ActiveMeetingRoom;

// The one meeting room that is open (set by its controller) — mirror of web
// `lib/meetings/active-room.ts`. The personal queue forwards room events to it
// when the meeting id matches.
ActiveMeetingRoom? _active;

void setActiveMeetingRoom(ActiveMeetingRoom? room) => _active = room;

ActiveMeetingRoom? activeMeetingRoom() => _active;

/// An open room that can say whether its media is live.
abstract interface class LiveMeetingRoom implements ActiveMeetingRoom {
  /// Connecting to or inside the room.
  bool get isLive;
}

/// A meeting is running on this device (connecting / in the room): the app
/// keeps STOMP and the audio going in the background, like a call.
bool meetingInProgress() {
  final room = _active;
  return room is LiveMeetingRoom && room.isLive;
}
