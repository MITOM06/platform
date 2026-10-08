// Contract models for the chat-service meetings REST API
// (docs/api-spec.md § Meetings) — mirror of web `lib/api/meeting-types.ts`.
//
// Every `fromJson` is defensive: malformed input ⇒ null (or a dropped row),
// never an exception.

import 'json_read.dart';
import 'meeting_settings.dart';

export 'meeting_settings.dart';

enum MeetingStatus {
  scheduled('SCHEDULED'),
  live('LIVE'),
  ended('ENDED');

  const MeetingStatus(this.wire);
  final String wire;

  static MeetingStatus? fromWire(Object? v) {
    for (final s in values) {
      if (s.wire == v) return s;
    }
    return null;
  }
}

enum MeetingViewerRole {
  host,
  cohost,
  invited,
  guest;

  static MeetingViewerRole? fromWire(Object? v) {
    for (final r in values) {
      if (r.name == v) return r;
    }
    return null;
  }
}

enum MeetingRoomRole { host, cohost, attendee }

enum MeetingListScope { upcoming, past }

enum NoteScope { shared, private }

/// Unknown / missing role ⇒ attendee (web `role()` in meeting-events).
MeetingRoomRole roomRoleFromWire(Object? v) {
  for (final r in MeetingRoomRole.values) {
    if (r.name == v) return r;
  }
  return MeetingRoomRole.attendee;
}

/// A person next to a meeting. No name ⇒ generic label in the UI, never the id.
class MeetingPerson {
  const MeetingPerson({required this.userId, this.displayName, this.avatarUrl});

  final String userId;
  final String? displayName;
  final String? avatarUrl;

  static MeetingPerson? fromJson(Object? v) {
    final o = asJson(v);
    final id = str(o?['userId']);
    if (o == null || id == null) return null;
    return MeetingPerson(
      userId: id,
      displayName: str(o['displayName']),
      avatarUrl: str(o['avatarUrl']),
    );
  }

  @override
  bool operator ==(Object other) =>
      other is MeetingPerson &&
      other.userId == userId &&
      other.displayName == displayName &&
      other.avatarUrl == avatarUrl;

  @override
  int get hashCode => Object.hash(userId, displayName, avatarUrl);
}

class MeetingAttendance {
  const MeetingAttendance({
    required this.userId,
    this.displayName,
    required this.role,
    required this.joinedAt,
    this.leftAt,
  });

  final String userId;
  final String? displayName;
  final MeetingRoomRole role;
  final DateTime joinedAt;
  final DateTime? leftAt;

  /// null when userId or joinedAt is missing.
  static MeetingAttendance? fromJson(Object? v) {
    final o = asJson(v);
    final id = str(o?['userId']);
    final joinedAt = dateOrNull(o?['joinedAt']);
    if (o == null || id == null || joinedAt == null) return null;
    return MeetingAttendance(
      userId: id,
      displayName: str(o['displayName']),
      role: roomRoleFromWire(o['role']),
      joinedAt: joinedAt,
      leftAt: dateOrNull(o['leftAt']),
    );
  }
}

class Meeting {
  const Meeting({
    required this.id,
    required this.code,
    this.title,
    this.description,
    required this.host,
    this.coHosts = const [],
    this.invitees = const [],
    this.departmentId,
    this.scheduledStart,
    this.scheduledEnd,
    required this.status,
    this.settings = MeetingSettings.defaults,
    this.attendance = const [],
    this.removedIds = const [],
    required this.viewerRole,
    required this.createdAt,
    this.startedAt,
    this.endedAt,
    this.cancelledAt,
  });

  final String id;
  final String code;
  final String? title;
  final String? description;
  final MeetingPerson host;
  final List<MeetingPerson> coHosts;
  final List<MeetingPerson> invitees;
  final String? departmentId;
  final DateTime? scheduledStart;
  final DateTime? scheduledEnd;
  final MeetingStatus status;
  final MeetingSettings settings;
  final List<MeetingAttendance> attendance;

  /// host/co-host only — raw ids for matching, NEVER rendered.
  final List<String> removedIds;
  final MeetingViewerRole viewerRole;
  final DateTime createdAt;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final DateTime? cancelledAt;

  bool get isCancelled => status == MeetingStatus.ended && cancelledAt != null;

  /// null when id/code/host/status/viewerRole/createdAt is missing or malformed.
  static Meeting? fromJson(Object? v) {
    final o = asJson(v);
    if (o == null) return null;
    final id = str(o['id']);
    final code = str(o['code']);
    final host = MeetingPerson.fromJson(o['host']);
    final status = MeetingStatus.fromWire(o['status']);
    final viewerRole = MeetingViewerRole.fromWire(o['viewerRole']);
    final createdAt = dateOrNull(o['createdAt']);
    if (id == null ||
        code == null ||
        host == null ||
        status == null ||
        viewerRole == null ||
        createdAt == null) {
      return null;
    }
    final removed = o['removedIds'];
    return Meeting(
      id: id,
      code: code,
      title: str(o['title']),
      description: str(o['description']),
      host: host,
      coHosts: rowsOf(o['coHosts'], MeetingPerson.fromJson),
      invitees: rowsOf(o['invitees'], MeetingPerson.fromJson),
      departmentId: str(o['departmentId']),
      scheduledStart: dateOrNull(o['scheduledStart']),
      scheduledEnd: dateOrNull(o['scheduledEnd']),
      status: status,
      settings:
          MeetingSettings.fromJson(o['settings']) ?? MeetingSettings.defaults,
      attendance: rowsOf(o['attendance'], MeetingAttendance.fromJson),
      removedIds: removed is List
          ? List.unmodifiable(removed.whereType<String>())
          : const [],
      viewerRole: viewerRole,
      createdAt: createdAt,
      startedAt: dateOrNull(o['startedAt']),
      endedAt: dateOrNull(o['endedAt']),
      cancelledAt: dateOrNull(o['cancelledAt']),
    );
  }

  Meeting copyWith({
    MeetingStatus? status,
    MeetingSettings? settings,
    DateTime? endedAt,
    DateTime? cancelledAt,
  }) =>
      Meeting(
        id: id,
        code: code,
        title: title,
        description: description,
        host: host,
        coHosts: coHosts,
        invitees: invitees,
        departmentId: departmentId,
        scheduledStart: scheduledStart,
        scheduledEnd: scheduledEnd,
        status: status ?? this.status,
        settings: settings ?? this.settings,
        attendance: attendance,
        removedIds: removedIds,
        viewerRole: viewerRole,
        createdAt: createdAt,
        startedAt: startedAt,
        endedAt: endedAt ?? this.endedAt,
        cancelledAt: cancelledAt ?? this.cancelledAt,
      );
}

class MeetingPage {
  const MeetingPage({required this.content, required this.hasNext});

  final List<Meeting> content;
  final bool hasNext;

  /// Broken rows are dropped; a non-object body is an empty last page.
  static MeetingPage fromJson(Object? v) {
    final o = asJson(v);
    return MeetingPage(
      content: rowsOf(o?['content'], Meeting.fromJson),
      hasNext: boolOrNull(o?['hasNext']) ?? false,
    );
  }
}

/// POST/PATCH body. PATCH: null = unchanged; '' clears
/// title/description/departmentId.
class MeetingInput {
  const MeetingInput({
    this.title,
    this.description,
    this.inviteeIds,
    this.departmentId,
    this.scheduledStart,
    this.scheduledEnd,
    this.settings,
  });

  final String? title;
  final String? description;
  final List<String>? inviteeIds;
  final String? departmentId;
  final DateTime? scheduledStart;
  final DateTime? scheduledEnd;

  /// create: all 5; edit: only the changed ones.
  final Map<String, bool>? settings;

  /// Only non-null keys; times as ISO UTC with `Z`.
  Json toJson() => {
        if (title != null) 'title': title,
        if (description != null) 'description': description,
        if (inviteeIds != null) 'inviteeIds': List<String>.of(inviteeIds!),
        if (departmentId != null) 'departmentId': departmentId,
        if (scheduledStart != null)
          'scheduledStart': scheduledStart!.toUtc().toIso8601String(),
        if (scheduledEnd != null)
          'scheduledEnd': scheduledEnd!.toUtc().toIso8601String(),
        if (settings != null) 'settings': Map<String, bool>.of(settings!),
      };
}

/// A department the caller may attach a meeting to
/// (auth-service `GET /api/users/me/departments`).
class DepartmentOption {
  const DepartmentOption({required this.id, required this.name});

  final String id;
  final String name;

  static DepartmentOption? fromJson(Object? v) {
    final o = asJson(v);
    final id = o?['id'];
    final name = o?['name'];
    if (id is! String || name is! String) return null;
    return DepartmentOption(id: id, name: name);
  }

  @override
  bool operator ==(Object other) =>
      other is DepartmentOption && other.id == id && other.name == name;

  @override
  int get hashCode => Object.hash(id, name);
}

abstract final class MeetingLimits {
  static const title = 120;
  static const description = 2000;
  static const invitees = 100;
  static const chat = 2000;
  static const note = 50000;
  static const participants = 25;
  static const maxDurationMinutes = 24 * 60;
  static const startGraceMinutes = 5;
}
