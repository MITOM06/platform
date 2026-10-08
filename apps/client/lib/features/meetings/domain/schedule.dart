// Meeting times — mirror of web `lib/meetings/schedule.ts`.
//
// The form edits a local wall-clock date + time plus a length; the server only
// ever receives ISO UTC with `Z`. Dart cannot switch the process time zone in
// tests, so every function takes a [LocalZone]: [DeviceZone] in the app,
// [FixedOffsetZone] in tests.

import 'package:intl/intl.dart';

import 'meeting_models.dart';

abstract interface class LocalZone {
  /// Wall clock → UTC instant; null when that local time does not exist
  /// (DST gap) or the fields are out of range.
  DateTime? toUtc(int year, int month, int day, int hour, int minute);

  /// UTC instant → a DateTime whose y/m/d/h/min are the local wall clock.
  DateTime wallClock(DateTime utc);

  Duration offsetAt(DateTime utc);
}

bool _sameFields(DateTime d, int y, int mo, int day, int h, int mi) =>
    d.year == y &&
    d.month == mo &&
    d.day == day &&
    d.hour == h &&
    d.minute == mi;

/// The device's own zone (DST-aware via the platform).
class DeviceZone implements LocalZone {
  const DeviceZone();

  @override
  DateTime? toUtc(int year, int month, int day, int hour, int minute) {
    final local = DateTime(year, month, day, hour, minute);
    return _sameFields(local, year, month, day, hour, minute)
        ? local.toUtc()
        : null;
  }

  @override
  DateTime wallClock(DateTime utc) => utc.toLocal();

  @override
  Duration offsetAt(DateTime utc) => utc.toLocal().timeZoneOffset;
}

/// A zone with a constant offset and no DST (tests; Asia/Ho_Chi_Minh = +7).
class FixedOffsetZone implements LocalZone {
  const FixedOffsetZone(this.offset);

  final Duration offset;

  @override
  DateTime? toUtc(int year, int month, int day, int hour, int minute) {
    final wall = DateTime.utc(year, month, day, hour, minute);
    return _sameFields(wall, year, month, day, hour, minute)
        ? wall.subtract(offset)
        : null;
  }

  @override
  DateTime wallClock(DateTime utc) => utc.toUtc().add(offset);

  @override
  Duration offsetAt(DateTime utc) => offset;
}

/// What the form edits.
class LocalSchedule {
  const LocalSchedule(
      {required this.date, required this.time, required this.durationMinutes});

  /// YYYY-MM-DD, local.
  final String date;

  /// HH:mm, local.
  final String time;
  final int durationMinutes;

  LocalSchedule copyWith({String? date, String? time, int? durationMinutes}) =>
      LocalSchedule(
        date: date ?? this.date,
        time: time ?? this.time,
        durationMinutes: durationMinutes ?? this.durationMinutes,
      );

  @override
  bool operator ==(Object other) =>
      other is LocalSchedule &&
      other.date == date &&
      other.time == time &&
      other.durationMinutes == durationMinutes;

  @override
  int get hashCode => Object.hash(date, time, durationMinutes);

  @override
  String toString() => 'LocalSchedule($date $time, $durationMinutes min)';
}

const kDurationPresets = [15, 30, 45, 60, 90, 120, 180, 240];
const _defaultDuration = 30;

final _dateRe = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');
final _timeRe = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$');

String _pad(int n) => n.toString().padLeft(2, '0');

/// A wall-clock calendar day as YYYY-MM-DD (never the UTC date).
String toDateString(DateTime wallClock) =>
    '${wallClock.year.toString().padLeft(4, '0')}-'
    '${_pad(wallClock.month)}-${_pad(wallClock.day)}';

String _timeString(DateTime wallClock) =>
    '${_pad(wallClock.hour)}:${_pad(wallClock.minute)}';

/// YYYY-MM-DD → local midnight (date picker), or null when malformed / not a
/// real day.
DateTime? parseDateString(String date) {
  final m = _dateRe.firstMatch(date);
  if (m == null) return null;
  final d = DateTime(
      int.parse(m.group(1)!), int.parse(m.group(2)!), int.parse(m.group(3)!));
  return toDateString(d) == date ? d : null;
}

/// Local wall clock → UTC; null when malformed or not a real local time.
DateTime? localToUtc(String date, String time, LocalZone zone) {
  final dm = _dateRe.firstMatch(date);
  final tm = _timeRe.firstMatch(time);
  if (dm == null || tm == null) return null;
  return zone.toUtc(
    int.parse(dm.group(1)!),
    int.parse(dm.group(2)!),
    int.parse(dm.group(3)!),
    int.parse(tm.group(1)!),
    int.parse(tm.group(2)!),
  );
}

({DateTime start, DateTime end})? buildSchedule(
    LocalSchedule s, LocalZone zone) {
  final start = localToUtc(s.date, s.time, zone);
  if (start == null) return null;
  return (start: start, end: start.add(Duration(minutes: s.durationMinutes)));
}

/// No start ⇒ null; no / invalid end ⇒ 30 minutes.
LocalSchedule? scheduleFromMeeting(Meeting m, LocalZone zone) {
  final start = m.scheduledStart;
  if (start == null) return null;
  final end = m.scheduledEnd;
  final minutes = end == null
      ? _defaultDuration
      : (end.difference(start).inSeconds / 60).round();
  final wall = zone.wallClock(start);
  return LocalSchedule(
    date: toDateString(wall),
    time: _timeString(wall),
    durationMinutes: minutes > 0 ? minutes : _defaultDuration,
  );
}

/// Next :00/:30 strictly after [now], 30 minutes.
LocalSchedule defaultSchedule(DateTime now, LocalZone zone) {
  final w = zone.wallClock(now);
  // Field arithmetic in a zone-free DateTime; overflow (23:30 → next day)
  // normalizes on construction.
  final next = w.minute < 30
      ? DateTime.utc(w.year, w.month, w.day, w.hour, 30)
      : DateTime.utc(w.year, w.month, w.day, w.hour + 1);
  return LocalSchedule(
    date: toDateString(next),
    time: _timeString(next),
    durationMinutes: _defaultDuration,
  );
}

/// Presets plus [current] when it is not one of them, ascending.
List<int> durationOptions([int? current]) {
  final out = [...kDurationPresets];
  if (current != null && current > 0 && !out.contains(current)) {
    out.add(current);
  }
  return out..sort();
}

({int hours, int minutes}) splitDuration(int minutes) =>
    (hours: minutes ~/ 60, minutes: minutes % 60);

/// 'GMT+7', 'GMT+5:30', 'GMT-3', 'GMT'.
String timeZoneLabel(Duration offset) {
  if (offset == Duration.zero) return 'GMT';
  final sign = offset.isNegative ? '-' : '+';
  final total = offset.inMinutes.abs();
  final h = total ~/ 60;
  final m = total % 60;
  return m == 0 ? 'GMT$sign$h' : 'GMT$sign$h:${_pad(m)}';
}

final _dateTimeFormats = <String, DateFormat>{};
final _timeFormats = <String, DateFormat>{};

DateFormat _dateTime(String locale) => _dateTimeFormats.putIfAbsent(
    locale, () => DateFormat.yMMMd(locale).add_jm());
DateFormat _time(String locale) =>
    _timeFormats.putIfAbsent(locale, () => DateFormat.jm(locale));

/// Locale-formatted "date, start – end" (same local day), "start – end" (two
/// days) or just the start — DateFormat, never a fixed pattern.
String formatMeetingRange(
    String locale, DateTime start, DateTime? end, LocalZone zone) {
  final s = zone.wallClock(start);
  final full = _dateTime(locale);
  if (end == null || end.isBefore(start)) return full.format(s);
  final e = zone.wallClock(end);
  final sameDay = s.year == e.year && s.month == e.month && s.day == e.day;
  return sameDay
      ? '${full.format(s)} – ${_time(locale).format(e)}'
      : '${full.format(s)} – ${full.format(e)}';
}

final _monthFormats = <String, DateFormat>{};
final _dayFormats = <String, DateFormat>{};

/// Short month of a wall-clock date ("Oct", "thg 10") — list date block.
String monthShort(String locale, DateTime wallClock) => _monthFormats
    .putIfAbsent(locale, () => DateFormat.MMM(locale))
    .format(wallClock);

/// Day of month as the locale writes it ("8", "8日").
String dayOfMonth(String locale, DateTime wallClock) =>
    _dayFormats.putIfAbsent(locale, () => DateFormat.d(locale)).format(wallClock);

final _dateFormats = <String, DateFormat>{};

/// A wall-clock calendar day, locale-formatted ("Oct 8, 2026").
String formatLocalDate(String locale, DateTime wallClock) => _dateFormats
    .putIfAbsent(locale, () => DateFormat.yMMMd(locale))
    .format(wallClock);

/// Clock time of an instant in [zone] ("9:05 AM", "09:05") — chat lines.
String formatClockTime(String locale, DateTime utc, LocalZone zone) =>
    _time(locale).format(zone.wallClock(utc));
