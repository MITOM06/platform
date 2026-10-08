import '../domain/meeting_queue.dart';

export '../domain/meeting_queue.dart' show ActiveMeetingRoom;

// The one meeting room that is open (set by its controller) — mirror of web
// `lib/meetings/active-room.ts`. The personal queue forwards room events to it
// when the meeting id matches.
ActiveMeetingRoom? _active;

void setActiveMeetingRoom(ActiveMeetingRoom? room) => _active = room;

ActiveMeetingRoom? activeMeetingRoom() => _active;
