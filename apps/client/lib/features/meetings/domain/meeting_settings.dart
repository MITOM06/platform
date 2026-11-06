// The six per-meeting switches (web `MeetingSettings`). Re-exported by
// meeting_models.dart.

import 'json_read.dart';

class MeetingSettings {
  const MeetingSettings({
    this.waitingRoom = true,
    this.muteOnEntry = false,
    this.allowAttendeeScreenShare = true,
    this.attendeesCanEditNotes = true,
    this.locked = false,
    this.aiNotes = false,
  });

  /// Server defaults (api-spec CreateMeetingRequest).
  static const defaults = MeetingSettings();

  final bool waitingRoom;
  final bool muteOnEntry;
  final bool allowAttendeeScreenShare;
  final bool attendeesCanEditNotes;
  final bool locked;

  /// AI takes notes of the meeting; everyone in the room is told.
  final bool aiNotes;

  /// null unless the 5 original fields are booleans; `aiNotes` absent (older
  /// servers) reads as false (web `settings()` in meeting-events).
  static MeetingSettings? fromJson(Object? v) {
    final o = asJson(v);
    if (o == null) return null;
    final w = boolOrNull(o['waitingRoom']);
    final m = boolOrNull(o['muteOnEntry']);
    final s = boolOrNull(o['allowAttendeeScreenShare']);
    final n = boolOrNull(o['attendeesCanEditNotes']);
    final l = boolOrNull(o['locked']);
    if (w == null || m == null || s == null || n == null || l == null) {
      return null;
    }
    return MeetingSettings(
      waitingRoom: w,
      muteOnEntry: m,
      allowAttendeeScreenShare: s,
      attendeesCanEditNotes: n,
      locked: l,
      aiNotes: o['aiNotes'] == true,
    );
  }

  Map<String, bool> toJson() => {
        'waitingRoom': waitingRoom,
        'muteOnEntry': muteOnEntry,
        'allowAttendeeScreenShare': allowAttendeeScreenShare,
        'attendeesCanEditNotes': attendeesCanEditNotes,
        'locked': locked,
        'aiNotes': aiNotes,
      };

  MeetingSettings copyWith({
    bool? waitingRoom,
    bool? muteOnEntry,
    bool? allowAttendeeScreenShare,
    bool? attendeesCanEditNotes,
    bool? locked,
    bool? aiNotes,
  }) =>
      MeetingSettings(
        waitingRoom: waitingRoom ?? this.waitingRoom,
        muteOnEntry: muteOnEntry ?? this.muteOnEntry,
        allowAttendeeScreenShare:
            allowAttendeeScreenShare ?? this.allowAttendeeScreenShare,
        attendeesCanEditNotes:
            attendeesCanEditNotes ?? this.attendeesCanEditNotes,
        locked: locked ?? this.locked,
        aiNotes: aiNotes ?? this.aiNotes,
      );

  /// Only the fields that differ from [initial] (edit form — never a stale copy
  /// of the others).
  Map<String, bool> changedFrom(MeetingSettings initial) {
    final before = initial.toJson();
    return Map.fromEntries(
        toJson().entries.where((e) => before[e.key] != e.value));
  }

  @override
  bool operator ==(Object other) =>
      other is MeetingSettings &&
      other.waitingRoom == waitingRoom &&
      other.muteOnEntry == muteOnEntry &&
      other.allowAttendeeScreenShare == allowAttendeeScreenShare &&
      other.attendeesCanEditNotes == attendeesCanEditNotes &&
      other.locked == locked &&
      other.aiNotes == aiNotes;

  @override
  int get hashCode => Object.hash(waitingRoom, muteOnEntry,
      allowAttendeeScreenShare, attendeesCanEditNotes, locked, aiNotes);
}
