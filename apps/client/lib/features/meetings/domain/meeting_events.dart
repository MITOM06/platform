// STOMP meeting frames (`/user/queue/meeting`, `/topic/meeting/{id}`) → typed
// events — mirror of web `lib/meetings/meeting-events.ts`.
//
// Everything off the wire is `Object?` until it passes here. Junk / unknown
// events ⇒ null; broken rows inside a list are dropped instead of the event.

import 'dart:convert';

import 'json_read.dart';
import 'meeting_models.dart';
import 'meeting_room_models.dart';

sealed class MeetingEvent {
  const MeetingEvent();

  String? get meetingId;
}

/// An event that always belongs to one meeting (every one but `meet.error`).
sealed class MeetingScopedEvent extends MeetingEvent {
  const MeetingScopedEvent({required this.meetingId});

  @override
  final String meetingId;
}

final class RosterEvent extends MeetingScopedEvent {
  const RosterEvent({required super.meetingId, required this.participants});
  final List<RosterEntry> participants;
}

final class SettingsEvent extends MeetingScopedEvent {
  const SettingsEvent({required super.meetingId, required this.settings});
  final MeetingSettings settings;
}

final class EndedEvent extends MeetingScopedEvent {
  const EndedEvent({required super.meetingId});
}

final class HandsEvent extends MeetingScopedEvent {
  const HandsEvent({required super.meetingId, required this.hands});
  final List<MeetingHand> hands;
}

final class ChatEvent extends MeetingScopedEvent {
  const ChatEvent(
      {required super.meetingId, this.clientId, required this.message});
  final String? clientId;
  final MeetingChatMessage message;
}

final class NotesUpdatedEvent extends MeetingScopedEvent {
  const NotesUpdatedEvent(
      {required super.meetingId, required this.version, this.updatedBy});
  final int version;
  final MeetingPerson? updatedBy;
}

final class LobbyEvent extends MeetingScopedEvent {
  const LobbyEvent({required super.meetingId, required this.waiting});
  final List<LobbyEntry> waiting;
}

final class AdmittedEvent extends MeetingScopedEvent {
  const AdmittedEvent({required super.meetingId});
}

final class DeniedEvent extends MeetingScopedEvent {
  const DeniedEvent({required super.meetingId});
}

final class RemovedEvent extends MeetingScopedEvent {
  const RemovedEvent({required super.meetingId});
}

/// title/code ride along since gap B3 — absent on older servers.
final class CancelledEvent extends MeetingScopedEvent {
  const CancelledEvent({required super.meetingId, this.title, this.code});
  final String? title;
  final String? code;
}

final class MutedEvent extends MeetingScopedEvent {
  const MutedEvent({required super.meetingId, this.actor});
  final MeetingPerson? actor;
}

final class MeetErrorEvent extends MeetingEvent {
  const MeetErrorEvent({
    this.meetingId,
    this.action,
    this.clientId,
    required this.errorCode,
    this.params,
  });

  @override
  final String? meetingId;
  final HostAction? action;
  final String? clientId;
  final String errorCode;
  final Map<String, Object>? params;
}

/// [hostId]: identity only (placeholder row) — NEVER rendered.
final class InvitedEvent extends MeetingScopedEvent {
  const InvitedEvent({
    required super.meetingId,
    required this.code,
    this.title,
    this.hostId,
    this.hostName,
    this.scheduledStart,
  });

  final String code;
  final String? title;
  final String? hostId;
  final String? hostName;
  final DateTime? scheduledStart;
}

final class StartingEvent extends MeetingScopedEvent {
  const StartingEvent({
    required super.meetingId,
    required this.code,
    this.title,
    this.scheduledStart,
  });

  final String code;
  final String? title;
  final DateTime? scheduledStart;
}

/// A STOMP frame body (String) or an already decoded map → typed event;
/// junk ⇒ null.
MeetingEvent? parseMeetingEvent(Object? frame) {
  Object? raw = frame;
  if (frame is String) {
    try {
      raw = jsonDecode(frame);
    } on FormatException {
      return null;
    }
  }
  final o = asJson(raw);
  final event = o?['event'];
  if (o == null || event is! String) return null;
  if (event == 'meet.error') return _parseError(o);
  final meetingId = str(o['meetingId']);
  if (meetingId == null) return null;
  return _parseForMeeting(event, meetingId, o);
}

MeetingEvent? _parseError(Json o) {
  final errorCode = str(o['errorCode']);
  if (errorCode == null) return null;
  return MeetErrorEvent(
    meetingId: str(o['meetingId']),
    action: HostAction.fromWire(o['action']),
    clientId: str(o['clientId']),
    errorCode: errorCode,
    params: scalarParams(o['params']),
  );
}

MeetingEvent? _parseForMeeting(String event, String id, Json o) {
  switch (event) {
    case 'meet.roster':
      return RosterEvent(
          meetingId: id,
          participants: rowsOf(o['participants'], RosterEntry.fromJson));
    case 'meet.lobby':
      return LobbyEvent(
          meetingId: id, waiting: rowsOf(o['waiting'], LobbyEntry.fromJson));
    case 'meet.hands':
      return HandsEvent(
          meetingId: id, hands: rowsOf(o['hands'], MeetingHand.fromJson));
    case 'meet.settings':
      final s = MeetingSettings.fromJson(o['settings']);
      return s == null ? null : SettingsEvent(meetingId: id, settings: s);
    case 'meet.chat':
      final m = MeetingChatMessage.fromJson(o['message']);
      return m == null
          ? null
          : ChatEvent(meetingId: id, clientId: str(o['clientId']), message: m);
    case 'meet.notes.updated':
      final version = o['version'];
      if (version is! num) return null;
      return NotesUpdatedEvent(
          meetingId: id,
          version: version.toInt(),
          updatedBy: MeetingPerson.fromJson(o['updatedBy']));
    case 'meet.muted':
      return MutedEvent(
          meetingId: id, actor: MeetingPerson.fromJson(o['actor']));
    case 'meet.ended':
      return EndedEvent(meetingId: id);
    case 'meet.admitted':
      return AdmittedEvent(meetingId: id);
    case 'meet.denied':
      return DeniedEvent(meetingId: id);
    case 'meet.removed':
      return RemovedEvent(meetingId: id);
    case 'meet.cancelled':
      return CancelledEvent(
          meetingId: id, title: str(o['title']), code: str(o['code']));
    case 'meet.invited':
    case 'meet.starting':
      return _parseInvite(event, id, o);
    default:
      return null;
  }
}

MeetingEvent? _parseInvite(String event, String id, Json o) {
  final code = str(o['code']);
  if (code == null) return null;
  final title = str(o['title']);
  final start = dateOrNull(o['scheduledStart']);
  if (event == 'meet.starting') {
    return StartingEvent(
        meetingId: id, code: code, title: title, scheduledStart: start);
  }
  return InvitedEvent(
    meetingId: id,
    code: code,
    title: title,
    hostId: str(o['hostId']),
    hostName: str(o['hostName']),
    scheduledStart: start,
  );
}
