import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/cache_updates.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/room_events.dart';
import 'package:platform_client/features/meetings/state/meeting_room_state.dart';

MeetingChatMessage msg(String id, int second) => MeetingChatMessage(
    id: id,
    sender: const MeetingPerson(userId: 'a'),
    content: id,
    createdAt: DateTime.utc(2026, 10, 8, 0, 0, second));

void main() {
  const s = MeetingRoomState.initial;

  test('roster, hands and settings replace what the room had', () {
    final r = [RosterEntry(userId: 'a', role: MeetingRoomRole.host, joinedAt: DateTime.utc(2026))];
    expect(applyTopicEvent(s, RosterEvent(meetingId: 'm1', participants: r), meetingId: 'm1').roster, r);
    final h = [MeetingHand(userId: 'b', raisedAt: DateTime.utc(2026))];
    expect(applyTopicEvent(s, HandsEvent(meetingId: 'm1', hands: h), meetingId: 'm1').hands, h);
    final settings = MeetingSettings.defaults.copyWith(locked: true);
    expect(
        applyTopicEvent(s, SettingsEvent(meetingId: 'm1', settings: settings), meetingId: 'm1').settings,
        settings);
  });

  test('chat lines are appended once', () {
    final once = applyTopicEvent(s, ChatEvent(meetingId: 'm1', message: msg('x1', 1)), meetingId: 'm1');
    final twice = applyTopicEvent(once, ChatEvent(meetingId: 'm1', message: msg('x1', 1)), meetingId: 'm1');
    expect(twice.chat.lines.map((l) => l.id), ['x1']);
    expect(identical(twice, once), isTrue);
  });

  test("another meeting's event or a data-less one leaves the state untouched", () {
    expect(identical(applyTopicEvent(s, const EndedEvent(meetingId: 'other'), meetingId: 'm1'), s), isTrue);
    expect(
        identical(
            applyTopicEvent(s, const HandsEvent(meetingId: 'other', hands: []), meetingId: 'm1'), s),
        isTrue);
    expect(identical(applyTopicEvent(s, const EndedEvent(meetingId: 'm1'), meetingId: 'm1'), s), isTrue);
  });

  test('the newest page after a reconnect merges in time order without duplicates', () {
    final have = ChatHistory(lines: [msg('x1', 1), msg('x3', 3)], hasOlder: true);
    final merged = mergeLatestPage(
        have, MeetingMessagePage(content: [msg('x4', 4), msg('x3', 3), msg('x2', 2)], hasNext: true));
    expect(merged.lines.map((l) => l.id), ['x1', 'x2', 'x3', 'x4']);
    expect(merged.hasOlder, isTrue);
    expect(identical(mergeLatestPage(merged, MeetingMessagePage(content: [msg('x4', 4)], hasNext: false)), merged),
        isTrue);
    final fresh = mergeLatestPage(const ChatHistory(),
        MeetingMessagePage(content: [msg('x2', 2), msg('x1', 1)], hasNext: false));
    expect(fresh.lines.map((l) => l.id), ['x1', 'x2']);
  });
}
