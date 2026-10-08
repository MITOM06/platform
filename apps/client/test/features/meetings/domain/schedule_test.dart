import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/schedule.dart';

const zone = FixedOffsetZone(Duration(hours: 7)); // Asia/Ho_Chi_Minh, no DST
const s = LocalSchedule.new;

Meeting m({DateTime? start, DateTime? end}) => Meeting(id: 'm', code: 'c', host: const MeetingPerson(userId: 'h'),
    coHosts: const [], invitees: const [], scheduledStart: start, scheduledEnd: end, status: MeetingStatus.scheduled,
    settings: MeetingSettings.defaults, attendance: const [], removedIds: const [],
    viewerRole: MeetingViewerRole.host, createdAt: DateTime.utc(2026, 10, 7));

void main() {
  setUpAll(() async {
    await initializeDateFormatting('en');
    await initializeDateFormatting('vi');
  });

  group('local wall clock ⇄ UTC', () {
    test('sends UTC', () {
      expect(localToUtc('2026-10-08', '09:00', zone), DateTime.utc(2026, 10, 8, 2));
      expect(localToUtc('2026-10-08', '00:30', zone), DateTime.utc(2026, 10, 7, 17, 30));
      expect(localToUtc('2026-10-08', '09:00', zone)!.toIso8601String(), '2026-10-08T02:00:00.000Z');
    });

    test('rejects malformed and impossible dates', () {
      expect(localToUtc('2026-02-30', '09:00', zone), isNull);
      expect(localToUtc('2026-10-08', '9:00', zone), isNull);
      expect(localToUtc('', '09:00', zone), isNull);
      expect(localToUtc('2026-10-08', '24:00', zone), isNull);
    });

    test('builds start and end from a duration', () {
      final b = buildSchedule(s(date: '2026-10-08', time: '09:00', durationMinutes: 90), zone)!;
      expect((b.start, b.end), (DateTime.utc(2026, 10, 8, 2), DateTime.utc(2026, 10, 8, 3, 30)));
      expect(buildSchedule(s(date: 'x', time: '09:00', durationMinutes: 30), zone), isNull);
    });

    test('reads a stored schedule back in local time', () {
      expect(scheduleFromMeeting(m(start: DateTime.utc(2026, 10, 8, 2), end: DateTime.utc(2026, 10, 8, 2, 45)), zone),
          s(date: '2026-10-08', time: '09:00', durationMinutes: 45));
      expect(scheduleFromMeeting(m(start: DateTime.utc(2026, 10, 8, 2)), zone),
          s(date: '2026-10-08', time: '09:00', durationMinutes: 30));
      expect(scheduleFromMeeting(m(), zone), isNull);
    });

    test('defaults to the next half hour', () {
      expect(defaultSchedule(DateTime.utc(2026, 10, 8, 2, 10), zone), s(date: '2026-10-08', time: '09:30', durationMinutes: 30));
      expect(defaultSchedule(DateTime.utc(2026, 10, 8, 2, 30), zone), s(date: '2026-10-08', time: '10:00', durationMinutes: 30));
      expect(defaultSchedule(DateTime.utc(2026, 10, 8, 16, 50), zone), s(date: '2026-10-09', time: '00:00', durationMinutes: 30));
    });

    test('labels the zone with its offset', () {
      expect(timeZoneLabel(const Duration(hours: 7)), 'GMT+7');
      expect(timeZoneLabel(const Duration(hours: 5, minutes: 30)), 'GMT+5:30');
      expect(timeZoneLabel(const Duration(hours: -3)), 'GMT-3');
      expect(timeZoneLabel(Duration.zero), 'GMT');
    });

    test('the device zone round-trips any wall clock it accepts', () {
      const device = DeviceZone();
      final utc = device.toUtc(2026, 10, 8, 9, 0)!;
      final wall = device.wallClock(utc);
      expect((wall.year, wall.month, wall.day, wall.hour, wall.minute), (2026, 10, 8, 9, 0));
    });
  });

  group('durations', () {
    test('keeps a custom stored duration selectable', () {
      expect(durationOptions(), [15, 30, 45, 60, 90, 120, 180, 240]);
      expect(durationOptions(50), [15, 30, 45, 50, 60, 90, 120, 180, 240]);
      expect(durationOptions(60), hasLength(8));
    });
    test('splits minutes for display', () {
      expect(splitDuration(90), (hours: 1, minutes: 30));
      expect(splitDuration(45), (hours: 0, minutes: 45));
    });
  });

  test('formatMeetingRange uses the locale, never a hardcoded pattern', () {
    final en = formatMeetingRange('en', DateTime.utc(2026, 10, 8, 2), DateTime.utc(2026, 10, 8, 3), zone);
    expect(en, contains('9:00'));
    expect(en, contains('10:00'));
    // intl's vi data is 24-hour `H:mm` (web ICU: `HH:mm`) — assert the locale, not a pattern.
    final vi = formatMeetingRange('vi', DateTime.utc(2026, 10, 8, 2), null, zone);
    expect(vi, contains('9:00'));
    expect(vi, isNot(contains('AM')));
    expect(en, contains('AM'));
  });

  test('date picker helpers round-trip a local calendar day', () {
    final d = parseDateString('2026-10-08')!;
    expect(toDateString(d), '2026-10-08');
    expect(parseDateString('2026-02-30'), isNull);
    expect(parseDateString('nope'), isNull);
  });
}
