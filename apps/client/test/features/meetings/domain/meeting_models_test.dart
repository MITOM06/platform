import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';

Map<String, dynamic> meetingJson([Map<String, dynamic> over = const {}]) => {
      'id': 'm1', 'code': 'abc-defg-hjk', 'title': 'Weekly sync',
      'host': {'userId': 'h1', 'displayName': 'Lan', 'avatarUrl': '/api/uploads/a.png'},
      'coHosts': [{'userId': 'c1'}], 'invitees': [{'userId': 'i1', 'displayName': 'Hoa'}, {'nope': 1}],
      'scheduledStart': '2026-10-08T02:00:00Z', 'scheduledEnd': '2026-10-08T03:00:00Z',
      'status': 'SCHEDULED',
      'settings': {'waitingRoom': true, 'muteOnEntry': false, 'allowAttendeeScreenShare': true,
          'attendeesCanEditNotes': true, 'locked': false},
      'attendance': [{'userId': 'h1', 'role': 'host', 'joinedAt': '2026-10-08T02:00:05Z'}],
      'viewerRole': 'host', 'createdAt': '2026-10-07T09:00:00Z',
      ...over,
    };

void main() {
  group('Meeting.fromJson', () {
    test('reads the shipped contract and drops broken rows', () {
      final m = Meeting.fromJson(meetingJson())!;
      expect(m.id, 'm1');
      expect(m.status, MeetingStatus.scheduled);
      expect(m.viewerRole, MeetingViewerRole.host);
      expect(m.host.displayName, 'Lan');
      expect(m.invitees.map((p) => p.userId), ['i1']);
      expect(m.scheduledStart, DateTime.utc(2026, 10, 8, 2));
      expect(m.attendance.single.role, MeetingRoomRole.host);
      expect(m.attendance.single.leftAt, isNull);
      expect(m.settings, MeetingSettings.defaults);
      expect(m.removedIds, isEmpty);
    });

    test('is null when a required field is missing or of the wrong type', () {
      expect(Meeting.fromJson(meetingJson({'id': null})), isNull);
      expect(Meeting.fromJson(meetingJson({'status': 'PAUSED'})), isNull);
      expect(Meeting.fromJson(meetingJson({'host': 'h1'})), isNull);
      expect(Meeting.fromJson('not a map'), isNull);
    });

    test('falls back to default settings when the block is malformed', () {
      expect(Meeting.fromJson(meetingJson({'settings': {'locked': 'yes'}}))!.settings, MeetingSettings.defaults);
      expect(MeetingSettings.fromJson({'locked': true}), isNull);
    });
  });

  group('MeetingInput.toJson', () {
    test('sends only what is set, times as UTC with Z', () {
      final input = MeetingInput(
        title: 'Sprint review', inviteeIds: const ['a', 'b'],
        scheduledStart: DateTime.parse('2026-10-09T14:00:00+07:00'),
        scheduledEnd: DateTime.parse('2026-10-09T15:00:00+07:00'),
        settings: MeetingSettings.defaults.toJson(),
      );
      expect(input.toJson(), {
        'title': 'Sprint review', 'inviteeIds': ['a', 'b'],
        'scheduledStart': '2026-10-09T07:00:00.000Z', 'scheduledEnd': '2026-10-09T08:00:00.000Z',
        'settings': {'waitingRoom': true, 'muteOnEntry': false, 'allowAttendeeScreenShare': true,
            'attendeesCanEditNotes': true, 'locked': false},
      });
      expect(const MeetingInput().toJson(), isEmpty);
      expect(const MeetingInput(title: '', description: '').toJson(), {'title': '', 'description': ''});
    });

    test('settings diff keeps only flipped switches', () {
      final next = MeetingSettings.defaults.copyWith(muteOnEntry: true);
      expect(next.changedFrom(MeetingSettings.defaults), {'muteOnEntry': true});
      expect(MeetingSettings.defaults.changedFrom(MeetingSettings.defaults), isEmpty);
    });
  });

  group('room models', () {
    test('join answers', () {
      expect(MeetingJoinResponse.fromJson({'status': 'waiting'}), isA<MeetingWaiting>());
      final j = MeetingJoinResponse.fromJson({'status': 'joined', 'url': 'wss://rtc', 'token': 't', 'role': 'cohost'});
      expect(j, isA<MeetingJoined>().having((x) => x.role, 'role', MeetingRoomRole.cohost));
      expect(() => MeetingJoinResponse.fromJson({'status': 'joined'}), throwsFormatException);
    });

    test('host actions round-trip their wire names and know which need a target', () {
      expect(HostAction.values, hasLength(13));
      for (final a in HostAction.values) {
        expect(HostAction.fromWire(a.wire), a);
      }
      expect(HostAction.values.where((a) => a.targeted).map((a) => a.wire).toSet(),
          {'MUTE_MIC', 'REMOVE', 'LOWER_HAND', 'MAKE_COHOST', 'REVOKE_COHOST'});
      expect(HostAction.fromWire('DROP_TABLE'), isNull);
    });
  });
}
