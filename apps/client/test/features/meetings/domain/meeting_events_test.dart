import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';

MeetingEvent? p(Map<String, dynamic> m) => parseMeetingEvent(jsonEncode(m));

void main() {
  test('meet.ai needs a state and a requester; code is read for this event', () {
    final e = p({'event': 'meet.ai', 'meetingId': 'm1', 'state': 'error', 'requesterId': 'u1', 'code': 'AI_UNAVAILABLE'}) as AiEvent;
    expect((e.state, e.requesterId, e.code), (AiState.error, 'u1', 'AI_UNAVAILABLE'));
    final t = p({'event': 'meet.ai', 'meetingId': 'm1', 'state': 'thinking', 'requesterId': 'u1', 'code': 'ABC'}) as AiEvent;
    expect(t.state, AiState.thinking);
    expect(p({'event': 'meet.ai', 'meetingId': 'm1', 'state': 'done', 'requesterId': 'u1'}), isNull);
    expect(p({'event': 'meet.ai', 'meetingId': 'm1', 'state': 'thinking'}), isNull);
    // An error without a requester is kept: it must still clear a pending entry.
    final anon = p({'event': 'meet.ai', 'meetingId': 'm1', 'state': 'error', 'code': 'AI_EMPTY'}) as AiEvent;
    expect((anon.state, anon.requesterId, anon.code), (AiState.error, '', 'AI_EMPTY'));
    expect(p({'event': 'meet.ai', 'meetingId': 'm1', 'state': 'thinking', 'requesterId': ''}), isNull);
  });

  test('roster keeps good rows, drops broken ones, defaults unknown roles to attendee', () {
    final e = p({'event': 'meet.roster', 'meetingId': 'm1', 'participants': [
      {'userId': 'a', 'displayName': 'An', 'role': 'cohost', 'joinedAt': '2026-10-08T02:00:00Z'},
      {'userId': 'b', 'role': 'emperor', 'joinedAt': '2026-10-08T02:01:00Z'},
      {'displayName': 'no id'}, 'junk',
    ]}) as RosterEvent;
    expect(e.participants.map((r) => (r.userId, r.role)),
        [('a', MeetingRoomRole.cohost), ('b', MeetingRoomRole.attendee)]);
  });

  test('meet.settings carries aiNotes; absent means false', () {
    final base = {'waitingRoom': false, 'muteOnEntry': true, 'allowAttendeeScreenShare': false,
        'attendeesCanEditNotes': true, 'locked': true};
    final on = p({'event': 'meet.settings', 'meetingId': 'm1', 'settings': {...base, 'aiNotes': true}});
    expect((on as SettingsEvent).settings.aiNotes, isTrue);
    final off = p({'event': 'meet.settings', 'meetingId': 'm1', 'settings': base});
    expect((off as SettingsEvent).settings.aiNotes, isFalse);
  });

  test('settings need the five original booleans', () {
    expect(p({'event': 'meet.settings', 'meetingId': 'm1', 'settings': {'locked': true}}), isNull);
    final ok = p({'event': 'meet.settings', 'meetingId': 'm1', 'settings': {'waitingRoom': false,
        'muteOnEntry': true, 'allowAttendeeScreenShare': false, 'attendeesCanEditNotes': true, 'locked': true}});
    expect((ok as SettingsEvent).settings.locked, isTrue);
  });

  test('hands keep the server order', () {
    final e = p({'event': 'meet.hands', 'meetingId': 'm1', 'hands': [
      {'userId': 'c', 'raisedAt': '2026-10-08T02:06:00Z'}, {'userId': 'a', 'raisedAt': '2026-10-08T02:07:00Z'}]});
    expect((e as HandsEvent).hands.map((h) => h.userId), ['c', 'a']);
  });

  test('chat needs a full message; the clientId rides along', () {
    final e = p({'event': 'meet.chat', 'meetingId': 'm1', 'clientId': 'c-abc', 'message': {
      'id': 'x', 'sender': {'userId': 'u'}, 'content': 'hi', 'createdAt': '2026-10-08T02:05:11.120Z'}});
    expect((e as ChatEvent).clientId, 'c-abc');
    expect(e.message.content, 'hi');
    expect(p({'event': 'meet.chat', 'meetingId': 'm1', 'message': {'id': 'x'}}), isNull);
  });

  test('meet.chat parses the attachment, dropping an invalid one', () {
    Object? att(Object? a) => (p({'event': 'meet.chat', 'meetingId': 'm1', 'message': {
          'id': 'x', 'sender': {'userId': 'u'}, 'content': '', 'createdAt': '2026-10-08T02:05:11.120Z',
          'attachment': a}}) as ChatEvent).message.attachment?.url;
    expect(att({'url': '/api/uploads/abc', 'name': 'a.pdf', 'size': 3}), '/api/uploads/abc');
    expect(att({'url': 'https://x/a', 'name': 'a.pdf'}), isNull);
  });

  test('meet.error keeps only known host actions and scalar params', () {
    final e = p({'event': 'meet.error', 'meetingId': 'm1', 'action': 'LOCK', 'errorCode': 'MEETINGS_UNAVAILABLE',
      'params': {'field': 'content', 'max': 2000, 'nested': {'x': 1}}}) as MeetErrorEvent;
    expect((e.action, e.errorCode), (HostAction.lock, 'MEETINGS_UNAVAILABLE'));
    expect(e.params, {'field': 'content', 'max': 2000});
    expect((p({'event': 'meet.error', 'action': 'DROP', 'errorCode': 'X'}) as MeetErrorEvent).action, isNull);
    expect(p({'event': 'meet.error', 'meetingId': 'm1'}), isNull);
  });

  test('invitations need a code; the host id is kept for identity only', () {
    final e = p({'event': 'meet.invited', 'meetingId': 'm2', 'code': 'xyz-wxyz-xyz', 'title': 'Planning',
      'hostId': 'h1', 'hostName': 'Lan', 'scheduledStart': '2026-10-08T02:00:00Z'}) as InvitedEvent;
    expect((e.code, e.hostId, e.hostName, e.scheduledStart), ('xyz-wxyz-xyz', 'h1', 'Lan', DateTime.utc(2026, 10, 8, 2)));
    expect(p({'event': 'meet.starting', 'meetingId': 'm2'}), isNull);
  });

  test('simple events, cancelled with optional title, muted with optional actor', () {
    expect(p({'event': 'meet.admitted', 'meetingId': 'm1'}), isA<AdmittedEvent>());
    expect(p({'event': 'meet.removed', 'meetingId': 'm1'}), isA<RemovedEvent>());
    expect((p({'event': 'meet.cancelled', 'meetingId': 'm1', 'title': 'T'}) as CancelledEvent).title, 'T');
    expect((p({'event': 'meet.muted', 'meetingId': 'm1'}) as MutedEvent).actor, isNull);
    expect((p({'event': 'meet.notes.updated', 'meetingId': 'm1', 'version': 7,
      'updatedBy': {'userId': 'u2', 'displayName': 'Minh'}}) as NotesUpdatedEvent).version, 7);
  });

  test('meet.summary.ready carries state and group; PENDING / unknown state is junk', () {
    final e = p({'event': 'meet.summary.ready', 'meetingId': 'm1', 'summaryState': 'DONE', 'groupConversationId': 'g1'})
        as SummaryReadyEvent;
    expect((e.meetingId, e.summaryState, e.groupConversationId), ('m1', MeetingSummaryState.done, 'g1'));
    final f = p({'event': 'meet.summary.ready', 'meetingId': 'm1', 'summaryState': 'FAILED'}) as SummaryReadyEvent;
    expect((f.summaryState, f.groupConversationId), (MeetingSummaryState.failed, null));
    expect(p({'event': 'meet.summary.ready', 'meetingId': 'm1', 'summaryState': 'PENDING'}), isNull);
    expect(p({'event': 'meet.summary.ready', 'meetingId': 'm1'}), isNull);
  });

  test('junk is null', () {
    expect(parseMeetingEvent('not json'), isNull);
    expect(parseMeetingEvent('[]'), isNull);
    expect(p({'event': 'meet.roster'}), isNull);
    expect(p({'event': 'meet.unknown', 'meetingId': 'm1'}), isNull);
    expect(p({'event': 'meet.notes.updated', 'meetingId': 'm1', 'version': '7'}), isNull);
  });
}
