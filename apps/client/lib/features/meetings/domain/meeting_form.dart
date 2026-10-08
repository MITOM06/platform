// Create / edit / meet-again form: values, client-side validation, request
// body — mirror of web `lib/meetings/meeting-form.ts`.

import 'meeting_models.dart';
import 'meeting_text.dart';
import 'schedule.dart';

enum MeetingFormMode { create, edit, again }

enum MeetingFormField { title, description, invitees, schedule }

class MeetingFormValues {
  const MeetingFormValues({
    required this.title,
    required this.description,
    required this.invitees,
    required this.departmentId,
    required this.scheduled,
    required this.schedule,
    required this.settings,
  });

  final String title;
  final String description;
  final List<MeetingPerson> invitees;

  /// '' = none.
  final String departmentId;
  final bool scheduled;
  final LocalSchedule schedule;
  final MeetingSettings settings;

  /// Only the fields passed (non-null) change.
  MeetingFormValues copyWith({
    String? title,
    String? description,
    List<MeetingPerson>? invitees,
    String? departmentId,
    bool? scheduled,
    LocalSchedule? schedule,
    MeetingSettings? settings,
  }) =>
      MeetingFormValues(
        title: title ?? this.title,
        description: description ?? this.description,
        invitees: invitees ?? this.invitees,
        departmentId: departmentId ?? this.departmentId,
        scheduled: scheduled ?? this.scheduled,
        schedule: schedule ?? this.schedule,
        settings: settings ?? this.settings,
      );
}

MeetingFormValues emptyMeetingForm(DateTime now, LocalZone zone) =>
    MeetingFormValues(
      title: '',
      description: '',
      invitees: const [],
      departmentId: '',
      scheduled: false,
      schedule: defaultSchedule(now, zone),
      settings: MeetingSettings.defaults,
    );

/// `edit` keeps the stored schedule; `again` (and `create`) copy people and
/// options but start unscheduled.
MeetingFormValues formFromMeeting(
    Meeting m, MeetingFormMode mode, DateTime now, LocalZone zone) {
  final stored =
      mode == MeetingFormMode.edit ? scheduleFromMeeting(m, zone) : null;
  return MeetingFormValues(
    title: m.title ?? '',
    description: m.description ?? '',
    invitees: List.unmodifiable(m.invitees),
    departmentId: m.departmentId ?? '',
    scheduled: stored != null,
    schedule: stored ?? defaultSchedule(now, zone),
    settings: m.settings,
  );
}

List<String> _uniqueIds(List<MeetingPerson> people) =>
    people.map((p) => p.userId).toSet().toList();

/// What the schedule would send: `send == false` ⇒ nothing (unscheduled,
/// LIVE, or unchanged); `built == null` ⇒ the local time is invalid.
({bool send, ({DateTime start, DateTime end})? built}) _scheduleChange(
    MeetingFormValues v, LocalZone zone, Meeting? original) {
  if (!v.scheduled || original?.status == MeetingStatus.live) {
    return (send: false, built: null);
  }
  final built = buildSchedule(v.schedule, zone);
  if (built != null &&
      original?.scheduledStart != null &&
      original?.scheduledEnd != null &&
      built.start.isAtSameMomentAs(original!.scheduledStart!) &&
      built.end.isAtSameMomentAs(original.scheduledEnd!)) {
    return (send: false, built: null);
  }
  return (send: true, built: built);
}

/// Client-side limits; the schedule is checked only when it is new/changed
/// and the meeting is not LIVE.
Map<MeetingFormField, MeetingNotice> validateMeetingForm(
    MeetingFormValues v, DateTime now, LocalZone zone,
    {Meeting? original}) {
  final errors = <MeetingFormField, MeetingNotice>{};
  if (v.title.trim().length > MeetingLimits.title) {
    errors[MeetingFormField.title] = const MeetingNotice(
        MeetingText.valTitleTooLong, {'max': MeetingLimits.title});
  }
  if (v.description.length > MeetingLimits.description) {
    errors[MeetingFormField.description] = const MeetingNotice(
        MeetingText.valDescriptionTooLong, {'max': MeetingLimits.description});
  }
  if (_uniqueIds(v.invitees).length > MeetingLimits.invitees) {
    errors[MeetingFormField.invitees] = const MeetingNotice(
        MeetingText.valTooManyInvitees, {'max': MeetingLimits.invitees});
  }
  final change = _scheduleChange(v, zone, original);
  if (change.send) {
    final built = change.built;
    final d = v.schedule.durationMinutes;
    if (built == null || d <= 0 || d > MeetingLimits.maxDurationMinutes) {
      errors[MeetingFormField.schedule] =
          const MeetingNotice(MeetingText.valScheduleInvalid);
    } else if (built.start.isBefore(now
        .subtract(const Duration(minutes: MeetingLimits.startGraceMinutes)))) {
      errors[MeetingFormField.schedule] =
          const MeetingNotice(MeetingText.valStartPast);
    }
  }
  return errors;
}

/// Create (no [original]) or PATCH body ('' clears). [original] must be the
/// meeting as the sheet opened it. Edit sends only the switches flipped in
/// this sheet — the others may have changed in the room meanwhile.
MeetingInput toMeetingInput(MeetingFormValues v, LocalZone zone,
    {Meeting? original}) {
  final title = v.title.trim();
  final description = v.description.trim().isNotEmpty ? v.description : '';
  final change = _scheduleChange(v, zone, original);
  final schedule = change.send ? change.built : null;

  if (original == null) {
    final ids = _uniqueIds(v.invitees);
    return MeetingInput(
      title: title.isEmpty ? null : title,
      description: description.isEmpty ? null : description,
      inviteeIds: ids.isEmpty ? null : ids,
      departmentId: v.departmentId.isEmpty ? null : v.departmentId,
      scheduledStart: schedule?.start,
      scheduledEnd: schedule?.end,
      settings: v.settings.toJson(),
    );
  }
  final changed = v.settings.changedFrom(original.settings);
  return MeetingInput(
    title: title != (original.title ?? '') ? title : null,
    description:
        description != (original.description ?? '') ? description : null,
    departmentId:
        v.departmentId != (original.departmentId ?? '') ? v.departmentId : null,
    inviteeIds: _uniqueIds(v.invitees),
    scheduledStart: schedule?.start,
    scheduledEnd: schedule?.end,
    settings: changed.isEmpty ? null : changed,
  );
}
