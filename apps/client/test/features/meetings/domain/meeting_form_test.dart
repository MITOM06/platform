import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_form.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/domain/schedule.dart';

const zone = FixedOffsetZone(Duration(hours: 7));
final now = DateTime.utc(2026, 10, 8, 2, 10); // 09:10 local

MeetingFormValues form({String title = '', String description = '', List<MeetingPerson> invitees = const [],
    String departmentId = '', bool scheduled = false, LocalSchedule? schedule}) =>
    emptyMeetingForm(now, zone).copyWith(title: title, description: description, invitees: invitees,
        departmentId: departmentId, scheduled: scheduled, schedule: schedule);

Meeting meeting({MeetingStatus status = MeetingStatus.scheduled, DateTime? start, DateTime? end}) => Meeting(
    id: 'm1', code: 'abc-defg-hjk', title: 'Weekly', description: 'Agenda', host: const MeetingPerson(userId: 'h'),
    coHosts: const [], invitees: const [MeetingPerson(userId: 'a', displayName: 'An')], departmentId: 'd1',
    scheduledStart: start ?? DateTime.utc(2026, 10, 9, 2), scheduledEnd: end ?? DateTime.utc(2026, 10, 9, 3),
    status: status, settings: MeetingSettings.defaults.copyWith(waitingRoom: false), attendance: const [],
    removedIds: const [], viewerRole: MeetingViewerRole.host, createdAt: DateTime.utc(2026, 10, 7));

LocalSchedule at(String date, String time, [int d = 30]) => LocalSchedule(date: date, time: time, durationMinutes: d);

void main() {
  group('validateMeetingForm', () {
    test('accepts an empty instant meeting', () => expect(validateMeetingForm(form(), now, zone), isEmpty));

    test('enforces the contract limits', () {
      final errors = validateMeetingForm(form(title: 'x' * 121, description: 'y' * 2001,
          invitees: [for (var i = 0; i < 101; i++) MeetingPerson(userId: 'u$i')]), now, zone);
      expect(errors, {
        MeetingFormField.title: const MeetingNotice(MeetingText.valTitleTooLong, {'max': 120}),
        MeetingFormField.description: const MeetingNotice(MeetingText.valDescriptionTooLong, {'max': 2000}),
        MeetingFormField.invitees: const MeetingNotice(MeetingText.valTooManyInvitees, {'max': 100}),
      });
      expect(validateMeetingForm(form(title: '  ${'x' * 120}  '), now, zone), isEmpty);
    });

    test('checks a new schedule but allows the 5-minute grace', () {
      expect(validateMeetingForm(form(scheduled: true, schedule: at('2026-10-08', '09:00')), now, zone)[MeetingFormField.schedule],
          const MeetingNotice(MeetingText.valStartPast));
      expect(validateMeetingForm(form(scheduled: true, schedule: at('2026-10-08', '09:06')), now, zone), isEmpty);
      expect(validateMeetingForm(form(scheduled: true, schedule: at('2026-02-30', '09:00')), now, zone)[MeetingFormField.schedule],
          const MeetingNotice(MeetingText.valScheduleInvalid));
      expect(validateMeetingForm(form(scheduled: true, schedule: at('2026-10-09', '09:00', 1441)), now, zone)[MeetingFormField.schedule],
          const MeetingNotice(MeetingText.valScheduleInvalid));
    });

    test('does not re-check an unchanged past schedule, nor a LIVE one', () {
      final past = meeting(start: DateTime.utc(2026, 10, 8, 1), end: DateTime.utc(2026, 10, 8, 2));
      expect(validateMeetingForm(formFromMeeting(past, MeetingFormMode.edit, now, zone), now, zone, original: past), isEmpty);
      final live = meeting(status: MeetingStatus.live);
      final edited = formFromMeeting(live, MeetingFormMode.edit, now, zone).copyWith(schedule: at('2026-10-08', '08:00'));
      expect(validateMeetingForm(edited, now, zone, original: live), isEmpty);
    });
  });

  group('toMeetingInput — create', () {
    test('sends only the settings for an untouched form', () {
      expect(toMeetingInput(form(), zone).toJson(), {'settings': MeetingSettings.defaults.toJson()});
    });

    test('sends a trimmed title, unique invitees, the department and a UTC schedule', () {
      final input = toMeetingInput(form(title: '  Sprint review ', description: 'Demo', departmentId: 'd1',
          invitees: const [MeetingPerson(userId: 'a'), MeetingPerson(userId: 'b'), MeetingPerson(userId: 'a')],
          scheduled: true, schedule: at('2026-10-09', '14:00', 60)), zone);
      expect(input.toJson(), {
        'title': 'Sprint review', 'description': 'Demo', 'inviteeIds': ['a', 'b'], 'departmentId': 'd1',
        'scheduledStart': '2026-10-09T07:00:00.000Z', 'scheduledEnd': '2026-10-09T08:00:00.000Z',
        'settings': MeetingSettings.defaults.toJson(),
      });
    });
  });

  group('toMeetingInput — edit (PATCH)', () {
    test('clears fields with empty strings and always replaces invitees', () {
      final m = meeting();
      final v = formFromMeeting(m, MeetingFormMode.edit, now, zone)
          .copyWith(title: '', description: '', departmentId: '', invitees: const []);
      expect(toMeetingInput(v, zone, original: m).toJson(),
          {'title': '', 'description': '', 'departmentId': '', 'inviteeIds': <String>[]});
    });

    test('sends only the switches the user changed, never a stale copy of the others', () {
      final m = meeting(status: MeetingStatus.live);
      final untouched = formFromMeeting(m, MeetingFormMode.edit, now, zone);
      expect(toMeetingInput(untouched, zone, original: m).toJson().containsKey('settings'), isFalse);
      final flipped = untouched.copyWith(settings: untouched.settings.copyWith(muteOnEntry: true));
      expect(toMeetingInput(flipped, zone, original: m).toJson()['settings'], {'muteOnEntry': true});
      final back = flipped.copyWith(settings: untouched.settings);
      expect(toMeetingInput(back, zone, original: m).toJson().containsKey('settings'), isFalse);
    });

    test('sends the schedule only when it changed and the meeting is not LIVE', () {
      final m = meeting();
      final moved = formFromMeeting(m, MeetingFormMode.edit, now, zone).copyWith(schedule: at('2026-10-09', '10:00', 60));
      expect(toMeetingInput(moved, zone, original: m).toJson(),
          containsPair('scheduledStart', '2026-10-09T03:00:00.000Z'));
      expect(toMeetingInput(formFromMeeting(m, MeetingFormMode.edit, now, zone), zone, original: m).toJson()
          .containsKey('scheduledStart'), isFalse);
      expect(toMeetingInput(moved, zone, original: meeting(status: MeetingStatus.live)).toJson()
          .containsKey('scheduledStart'), isFalse);
    });
  });

  group('formFromMeeting', () {
    test('"meet again" copies people and options but starts now', () {
      final v = formFromMeeting(meeting(status: MeetingStatus.ended), MeetingFormMode.again, now, zone);
      expect((v.title, v.description, v.departmentId, v.scheduled), ('Weekly', 'Agenda', 'd1', false));
      expect(v.invitees.single.displayName, 'An');
      expect(v.settings.waitingRoom, isFalse);
    });

    test('"edit" loads the stored schedule in local time', () {
      final v = formFromMeeting(meeting(), MeetingFormMode.edit, now, zone);
      expect((v.scheduled, v.schedule), (true, at('2026-10-09', '09:00', 60)));
    });
  });
}
