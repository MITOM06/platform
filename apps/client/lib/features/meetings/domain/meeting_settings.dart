// The five per-meeting switches (web `MeetingSettings`). Re-exported by
// meeting_models.dart.

import 'json_read.dart';

class MeetingSettings {
  const MeetingSettings({
    this.waitingRoom = true,
    this.muteOnEntry = false,
    this.allowAttendeeScreenShare = true,
    this.attendeesCanEditNotes = true,
    this.locked = false,
  });

  /// Server defaults (api-spec CreateMeetingRequest).
  static const defaults = MeetingSettings();

  final bool waitingRoom;
  final bool muteOnEntry;
  final bool allowAttendeeScreenShare;
  final bool attendeesCanEditNotes;
  final bool locked;

  /// null unless all 5 fields are booleans (web `settings()` in meeting-events).
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
    );
  }

  Map<String, bool> toJson() => {
        'waitingRoom': waitingRoom,
        'muteOnEntry': muteOnEntry,
        'allowAttendeeScreenShare': allowAttendeeScreenShare,
        'attendeesCanEditNotes': attendeesCanEditNotes,
        'locked': locked,
      };

  MeetingSettings copyWith({
    bool? waitingRoom,
    bool? muteOnEntry,
    bool? allowAttendeeScreenShare,
    bool? attendeesCanEditNotes,
    bool? locked,
  }) =>
      MeetingSettings(
        waitingRoom: waitingRoom ?? this.waitingRoom,
        muteOnEntry: muteOnEntry ?? this.muteOnEntry,
        allowAttendeeScreenShare:
            allowAttendeeScreenShare ?? this.allowAttendeeScreenShare,
        attendeesCanEditNotes:
            attendeesCanEditNotes ?? this.attendeesCanEditNotes,
        locked: locked ?? this.locked,
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
      other.locked == locked;

  @override
  int get hashCode => Object.hash(waitingRoom, muteOnEntry,
      allowAttendeeScreenShare, attendeesCanEditNotes, locked);
}
