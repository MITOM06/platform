import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/domain/room_host.dart';

RosterEntry r(String id, MeetingRoomRole role) =>
    RosterEntry(userId: id, role: role, joinedAt: DateTime.utc(2026));

void main() {
  test('targetId only for person actions', () {
    expect(hostCommandBody('m1', HostAction.muteMic, 'u2'),
        {'meetingId': 'm1', 'action': 'MUTE_MIC', 'targetId': 'u2'});
    expect(hostCommandBody('m1', HostAction.lock, 'ignored'), {'meetingId': 'm1', 'action': 'LOCK'});
  });

  test('muted notice never shows an id', () {
    expect(mutedNotice(const MeetingPerson(userId: 'h', displayName: 'Lan')),
        const MeetingNotice(MeetingText.mutedBy, {'name': 'Lan'}));
    expect(mutedNotice(const MeetingPerson(userId: '64b0aaaaaaaaaaaaaaaaaaaa')),
        const MeetingNotice(MeetingText.mutedByUnknown));
    expect(mutedNotice(null), const MeetingNotice(MeetingText.mutedByUnknown));
  });

  test('role changes from the roster', () {
    expect(roleChange([r('me', MeetingRoomRole.cohost)], 'me', MeetingRoomRole.attendee)!.notice,
        const MeetingNotice(MeetingText.madeCohost));
    final demoted = roleChange([r('me', MeetingRoomRole.attendee)], 'me', MeetingRoomRole.cohost)!;
    expect((demoted.role, demoted.notice, demoted.lostLobby),
        (MeetingRoomRole.attendee, const MeetingNotice(MeetingText.revokedCohost), true));
    expect(roleChange([r('me', MeetingRoomRole.host)], 'me', MeetingRoomRole.host), isNull);
    expect(roleChange([r('other', MeetingRoomRole.host)], 'me', MeetingRoomRole.attendee), isNull);
  });

  test('the room role before the roster comes from the viewer role', () {
    Meeting as(MeetingViewerRole v) => Meeting(
        id: 'm1',
        code: 'abc-defg-hjk',
        host: const MeetingPerson(userId: 'h'),
        status: MeetingStatus.live,
        viewerRole: v,
        createdAt: DateTime.utc(2026));
    expect(initialRoomRole(as(MeetingViewerRole.host)), MeetingRoomRole.host);
    expect(initialRoomRole(as(MeetingViewerRole.cohost)), MeetingRoomRole.cohost);
    expect(initialRoomRole(as(MeetingViewerRole.invited)), MeetingRoomRole.attendee);
    expect(initialRoomRole(as(MeetingViewerRole.guest)), MeetingRoomRole.attendee);
  });
}
