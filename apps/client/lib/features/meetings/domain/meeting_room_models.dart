// In-room contract models (join, chat, notes, hands, lobby, roster, host
// actions) — mirror of web `lib/api/meeting-types.ts`.

import 'json_read.dart';
import 'meeting_models.dart';

/// Placeholder time for a row whose timestamp is missing (web keeps `''`,
/// which sorts first — the epoch does the same).
final DateTime kMissingTime =
    DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);

/// `POST /api/meetings/{id}/join` answer.
sealed class MeetingJoinResponse {
  const MeetingJoinResponse();

  /// Unknown status or a `joined` without url/token ⇒ [FormatException].
  static MeetingJoinResponse fromJson(Object? v) {
    final o = asJson(v);
    final status = o?['status'];
    if (status == 'waiting') return const MeetingWaiting();
    if (status == 'joined') {
      final url = str(o?['url']);
      final token = str(o?['token']);
      if (url != null && token != null) {
        return MeetingJoined(
            url: url, token: token, role: roomRoleFromWire(o?['role']));
      }
    }
    throw const FormatException('malformed meeting join response');
  }
}

final class MeetingJoined extends MeetingJoinResponse {
  const MeetingJoined(
      {required this.url, required this.token, required this.role});

  final String url;
  final String token;
  final MeetingRoomRole role;
}

final class MeetingWaiting extends MeetingJoinResponse {
  const MeetingWaiting();
}

/// One in-meeting chat line (web `MeetingMessage`; named to avoid clashing
/// with the regular chat message model).
class MeetingChatMessage {
  const MeetingChatMessage({
    required this.id,
    required this.sender,
    required this.content,
    required this.createdAt,
  });

  final String id;
  final MeetingPerson sender;
  final String content;
  final DateTime createdAt;

  static MeetingChatMessage? fromJson(Object? v) {
    final o = asJson(v);
    if (o == null) return null;
    final sender = MeetingPerson.fromJson(o['sender']);
    final id = o['id'];
    final content = o['content'];
    final createdAt = dateOrNull(o['createdAt']);
    if (sender == null || id is! String || content is! String) return null;
    if (createdAt == null) return null;
    return MeetingChatMessage(
        id: id, sender: sender, content: content, createdAt: createdAt);
  }
}

/// A page of chat history, newest first.
class MeetingMessagePage {
  const MeetingMessagePage({required this.content, required this.hasNext});

  final List<MeetingChatMessage> content;
  final bool hasNext;

  static MeetingMessagePage fromJson(Object? v) {
    final o = asJson(v);
    return MeetingMessagePage(
      content: rowsOf(o?['content'], MeetingChatMessage.fromJson),
      hasNext: boolOrNull(o?['hasNext']) ?? false,
    );
  }
}

class MeetingNote {
  const MeetingNote({
    required this.scope,
    required this.content,
    required this.version,
    this.updatedBy,
    this.updatedAt,
  });

  final NoteScope scope;
  final String content;
  final int version;
  final MeetingPerson? updatedBy;
  final DateTime? updatedAt;

  /// null when scope/content/version is missing or malformed.
  static MeetingNote? fromJson(Object? v) {
    final o = asJson(v);
    if (o == null) return null;
    final scope = switch (o['scope']) {
      'shared' => NoteScope.shared,
      'private' => NoteScope.private,
      _ => null,
    };
    final content = o['content'];
    final version = o['version'];
    if (scope == null || content is! String || version is! num) return null;
    return MeetingNote(
      scope: scope,
      content: content,
      version: version.toInt(),
      updatedBy: MeetingPerson.fromJson(o['updatedBy']),
      updatedAt: dateOrNull(o['updatedAt']),
    );
  }
}

class MeetingHand {
  const MeetingHand(
      {required this.userId, this.displayName, required this.raisedAt});

  final String userId;
  final String? displayName;
  final DateTime raisedAt;

  static MeetingHand? fromJson(Json row) {
    final id = str(row['userId']);
    if (id == null) return null;
    return MeetingHand(
      userId: id,
      displayName: str(row['displayName']),
      raisedAt: dateOrNull(row['raisedAt']) ?? kMissingTime,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is MeetingHand &&
      other.userId == userId &&
      other.displayName == displayName &&
      other.raisedAt == raisedAt;

  @override
  int get hashCode => Object.hash(userId, displayName, raisedAt);
}

class LobbyEntry {
  const LobbyEntry({required this.userId, this.displayName});

  final String userId;
  final String? displayName;

  static LobbyEntry? fromJson(Json row) {
    final id = str(row['userId']);
    if (id == null) return null;
    return LobbyEntry(userId: id, displayName: str(row['displayName']));
  }

  @override
  bool operator ==(Object other) =>
      other is LobbyEntry &&
      other.userId == userId &&
      other.displayName == displayName;

  @override
  int get hashCode => Object.hash(userId, displayName);
}

class RosterEntry {
  const RosterEntry({
    required this.userId,
    this.displayName,
    required this.role,
    required this.joinedAt,
  });

  final String userId;
  final String? displayName;
  final MeetingRoomRole role;
  final DateTime joinedAt;

  static RosterEntry? fromJson(Json row) {
    final id = str(row['userId']);
    if (id == null) return null;
    return RosterEntry(
      userId: id,
      displayName: str(row['displayName']),
      role: roomRoleFromWire(row['role']),
      joinedAt: dateOrNull(row['joinedAt']) ?? kMissingTime,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is RosterEntry &&
      other.userId == userId &&
      other.displayName == displayName &&
      other.role == role &&
      other.joinedAt == joinedAt;

  @override
  int get hashCode => Object.hash(userId, displayName, role, joinedAt);
}

/// `/app/meet.host` actions (web `HOST_ACTIONS`).
enum HostAction {
  muteMic('MUTE_MIC', targeted: true),
  muteAll('MUTE_ALL'),
  remove('REMOVE', targeted: true),
  lowerHand('LOWER_HAND', targeted: true),
  lowerAllHands('LOWER_ALL_HANDS'),
  lock('LOCK'),
  unlock('UNLOCK'),
  waitingRoomOn('WAITING_ROOM_ON'),
  waitingRoomOff('WAITING_ROOM_OFF'),
  attendeeScreenShareOn('ATTENDEE_SCREEN_SHARE_ON'),
  attendeeScreenShareOff('ATTENDEE_SCREEN_SHARE_OFF'),
  makeCohost('MAKE_COHOST', targeted: true),
  revokeCohost('REVOKE_COHOST', targeted: true);

  const HostAction(this.wire, {this.targeted = false});

  final String wire;

  /// Needs a `targetId` (the server ignores it for the others).
  final bool targeted;

  static HostAction? fromWire(Object? v) {
    for (final a in values) {
      if (a.wire == v) return a;
    }
    return null;
  }
}

const kReactionEmojis = ['👍', '❤️', '😂', '😮', '👏', '🎉'];
