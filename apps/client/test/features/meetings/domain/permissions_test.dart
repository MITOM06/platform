import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/permissions.dart';

const base = MeetingSettings.defaults;
Meeting meeting({MeetingStatus status = MeetingStatus.scheduled, MeetingViewerRole role = MeetingViewerRole.host,
    MeetingSettings settings = base, List<MeetingAttendance> attendance = const []}) => Meeting(id: 'm1',
    code: 'abc-defg-hjk', host: const MeetingPerson(userId: 'h'), coHosts: const [], invitees: const [],
    status: status, settings: settings, attendance: attendance, removedIds: const [], viewerRole: role,
    createdAt: DateTime.utc(2026, 10, 7));
PersonTarget target({String userId = 't', MeetingRoomRole role = MeetingRoomRole.attendee, bool hand = false, bool mic = true}) =>
    PersonTarget(userId: userId, role: role, handRaised: hand, micOn: mic);
(bool, bool, bool, bool, bool, bool) flags(DetailActions a) => (a.join, a.copyLink, a.edit, a.cancel, a.end, a.meetAgain);

void main() {
  group('detailActions', () {
    test('host of a scheduled meeting nobody joined: join, copy, edit, cancel', () {
      expect(flags(detailActions(meeting(), canHost: true)), (true, true, true, true, false, false));
    });
    test('cannot cancel once someone joined or when LIVE; managers can end a LIVE meeting', () {
      final joined = meeting(attendance: [MeetingAttendance(userId: 'a', role: MeetingRoomRole.attendee,
          joinedAt: DateTime.utc(2026, 10, 8))]);
      expect(detailActions(joined, canHost: true).cancel, isFalse);
      expect(flags(detailActions(meeting(status: MeetingStatus.live, role: MeetingViewerRole.cohost), canHost: false)),
          (true, true, true, false, true, false));
    });
    test('invitees and guests only join and copy', () {
      for (final r in [MeetingViewerRole.invited, MeetingViewerRole.guest]) {
        expect(flags(detailActions(meeting(status: MeetingStatus.live, role: r), canHost: true)),
            (true, true, false, false, false, false));
      }
    });
    test('an ended meeting offers "meet again" to its hosts who can still host', () {
      expect(flags(detailActions(meeting(status: MeetingStatus.ended), canHost: true)), (false, false, false, false, false, true));
      expect(detailActions(meeting(status: MeetingStatus.ended), canHost: false).meetAgain, isFalse);
      expect(detailActions(meeting(status: MeetingStatus.ended, role: MeetingViewerRole.invited), canHost: true).meetAgain, isFalse);
    });
  });

  test('records and notes', () {
    expect(canSeeRecords(meeting(role: MeetingViewerRole.guest)), isFalse);
    expect(canSeeRecords(meeting(role: MeetingViewerRole.invited)), isTrue);
    final closed = base.copyWith(attendeesCanEditNotes: false);
    expect(canEditSharedNoteRoom(MeetingRoomRole.host, closed), isTrue);
    expect(canEditSharedNoteRoom(MeetingRoomRole.cohost, closed), isTrue);
    expect(canEditSharedNoteRoom(MeetingRoomRole.attendee, closed), isFalse);
    expect(canEditSharedNoteViewer(MeetingViewerRole.invited, base), isTrue);
    expect(canEditSharedNoteViewer(MeetingViewerRole.guest, closed), isFalse);
  });

  test('prejoinIntent: invited people join, strangers ask or are locked out', () {
    expect(prejoinIntent(meeting(role: MeetingViewerRole.invited)), PrejoinIntent.join);
    expect(prejoinIntent(meeting(role: MeetingViewerRole.cohost, settings: base.copyWith(locked: true))), PrejoinIntent.join);
    expect(prejoinIntent(meeting(role: MeetingViewerRole.guest)), PrejoinIntent.ask);
    expect(prejoinIntent(meeting(role: MeetingViewerRole.guest, settings: base.copyWith(waitingRoom: false))), PrejoinIntent.join);
    expect(prejoinIntent(meeting(role: MeetingViewerRole.guest, settings: base.copyWith(locked: true))), PrejoinIntent.locked);
  });

  group('room roles and host menus', () {
    test('my role follows the roster, else the join role', () {
      final roster = [RosterEntry(userId: 'me', role: MeetingRoomRole.cohost, joinedAt: DateTime.utc(2026))];
      expect(myRoomRole(roster, 'me', MeetingRoomRole.attendee), MeetingRoomRole.cohost);
      expect(myRoomRole(const [], 'me', MeetingRoomRole.attendee), MeetingRoomRole.attendee);
      expect(myRoomRole(null, 'me', MeetingRoomRole.host), MeetingRoomRole.host);
    });
    test('host can do everything to an attendee', () {
      expect(personActions(MeetingRoomRole.host, 'me', target(hand: true)),
          [HostAction.muteMic, HostAction.lowerHand, HostAction.makeCohost, HostAction.remove]);
    });
    test('host manages co-hosts; co-hosts only attendees; nobody targets the host or themselves', () {
      expect(personActions(MeetingRoomRole.host, 'me', target(role: MeetingRoomRole.cohost, mic: false)),
          [HostAction.revokeCohost, HostAction.remove]);
      expect(personActions(MeetingRoomRole.cohost, 'me', target()), [HostAction.muteMic, HostAction.remove]);
      expect(personActions(MeetingRoomRole.cohost, 'me', target(role: MeetingRoomRole.cohost)), [HostAction.muteMic]);
      expect(personActions(MeetingRoomRole.cohost, 'me', target(role: MeetingRoomRole.host, hand: true)),
          [HostAction.muteMic, HostAction.lowerHand]);
      expect(personActions(MeetingRoomRole.host, 'me', target(userId: 'me', role: MeetingRoomRole.host)), isEmpty);
      expect(personActions(MeetingRoomRole.attendee, 'me', target()), isEmpty);
    });
    test('room controls send the opposite of the current setting', () {
      expect(roomControls(MeetingRoomRole.attendee, base, anyHands: true), isNull);
      final c = roomControls(MeetingRoomRole.cohost, base, anyHands: false)!;
      expect((c.lowerAllHands, c.lock, c.waitingRoom, c.screenShare),
          (false, HostAction.lock, HostAction.waitingRoomOff, HostAction.attendeeScreenShareOff));
      final h = roomControls(MeetingRoomRole.host,
          base.copyWith(locked: true, waitingRoom: false, allowAttendeeScreenShare: false), anyHands: true)!;
      expect((h.lowerAllHands, h.lock, h.waitingRoom, h.screenShare),
          (true, HostAction.unlock, HostAction.waitingRoomOn, HostAction.attendeeScreenShareOn));
    });
    test('attendees present only when allowed', () {
      expect(canShareScreen(MeetingRoomRole.attendee, base), isTrue);
      expect(canShareScreen(MeetingRoomRole.attendee, base.copyWith(allowAttendeeScreenShare: false)), isFalse);
      expect(canShareScreen(MeetingRoomRole.cohost, base.copyWith(allowAttendeeScreenShare: false)), isTrue);
    });
    test('every host action is reachable from some menu state', () {
      final reachable = <HostAction>{};
      for (final t in [target(hand: true), target(role: MeetingRoomRole.cohost)]) {
        reachable.addAll(personActions(MeetingRoomRole.host, 'me', t));
      }
      for (final s in [base, base.copyWith(locked: true, waitingRoom: false, allowAttendeeScreenShare: false)]) {
        final rc = roomControls(MeetingRoomRole.host, s, anyHands: true)!;
        reachable.add(HostAction.muteAll);
        if (rc.lowerAllHands) reachable.add(HostAction.lowerAllHands);
        reachable.addAll([rc.lock, rc.waitingRoom, rc.screenShare]);
      }
      expect(reachable, HostAction.values.toSet());
    });
  });
}
