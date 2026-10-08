import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/schedule.dart';
import '../meeting_text_l10n.dart';

/// "When": Start now / Schedule, then date + time + length in the device's
/// time zone — mirror of web `MeetingScheduleFields`. The sheet turns these
/// into UTC (`buildSchedule`); this widget only edits local wall-clock text.
class MeetingScheduleFields extends StatelessWidget {
  const MeetingScheduleFields({
    super.key,
    required this.scheduled,
    required this.schedule,
    required this.onScheduledChange,
    required this.onScheduleChange,
    required this.allowNow,
    required this.now,
    this.disabled = false,
    this.error,
  });

  final bool scheduled;
  final LocalSchedule schedule;
  final ValueChanged<bool> onScheduledChange;
  final ValueChanged<LocalSchedule> onScheduleChange;

  /// "Start now" is impossible once a meeting has a schedule (the contract
  /// cannot clear it).
  final bool allowNow;

  /// Taken when the sheet opened.
  final DateTime now;

  /// A LIVE meeting's schedule cannot change.
  final bool disabled;
  final String? error;

  Future<void> _pickDate(BuildContext context) async {
    final today = DateTime(now.year, now.month, now.day);
    final last = today.add(const Duration(days: 365));
    var initial = parseDateString(schedule.date) ?? today;
    if (initial.isBefore(today)) initial = today;
    if (initial.isAfter(last)) initial = last;
    final picked = await showDatePicker(
        context: context, initialDate: initial, firstDate: today, lastDate: last);
    if (picked != null) {
      onScheduleChange(schedule.copyWith(date: toDateString(picked)));
    }
  }

  Future<void> _pickTime(BuildContext context) async {
    final picked = await showTimePicker(
        context: context, initialTime: _timeOf(schedule.time));
    if (picked != null) {
      final hh = picked.hour.toString().padLeft(2, '0');
      final mm = picked.minute.toString().padLeft(2, '0');
      onScheduleChange(schedule.copyWith(time: '$hh:$mm'));
    }
  }

  static TimeOfDay _timeOf(String hhmm) {
    final parts = hhmm.split(':');
    final h = parts.isNotEmpty ? int.tryParse(parts[0]) : null;
    final m = parts.length > 1 ? int.tryParse(parts[1]) : null;
    return TimeOfDay(hour: h ?? 9, minute: m ?? 0);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final locale = Localizations.localeOf(context).toLanguageTag();
    final date = parseDateString(schedule.date);
    final time = MaterialLocalizations.of(context).formatTimeOfDay(
        _timeOf(schedule.time),
        alwaysUse24HourFormat: MediaQuery.alwaysUse24HourFormatOf(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.meetingFieldWhen,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 8),
        SegmentedButton<bool>(
          segments: [
            if (allowNow)
              ButtonSegment(value: false, label: Text(l10n.meetingWhenNow)),
            ButtonSegment(value: true, label: Text(l10n.meetingWhenLater)),
          ],
          selected: {scheduled},
          showSelectedIcon: false,
          onSelectionChanged:
              disabled ? null : (s) => onScheduledChange(s.first),
        ),
        if (scheduled) ...[
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              flex: 3,
              child: _PickerField(
                label: l10n.meetingFieldDate,
                value: date == null
                    ? l10n.meetingFieldDate
                    : formatLocalDate(locale, date),
                icon: Icons.calendar_today_rounded,
                onTap: disabled ? null : () => _pickDate(context),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: _PickerField(
                label: l10n.meetingFieldTime,
                value: time,
                icon: Icons.schedule_rounded,
                error: error != null,
                onTap: disabled ? null : () => _pickTime(context),
              ),
            ),
          ]),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            initialValue: schedule.durationMinutes,
            isExpanded: true,
            decoration: InputDecoration(labelText: l10n.meetingFieldDuration),
            items: [
              for (final m in durationOptions(schedule.durationMinutes))
                DropdownMenuItem(
                    value: m, child: Text(meetingDurationLabel(l10n, m))),
            ],
            onChanged: disabled
                ? null
                : (m) {
                    if (m != null) {
                      onScheduleChange(schedule.copyWith(durationMinutes: m));
                    }
                  },
          ),
          const SizedBox(height: 8),
          Text(
            l10n.meetingTimeZoneHint(
                timeZoneLabel(const DeviceZone().offsetAt(now.toUtc()))),
            style: TextStyle(fontSize: 12, color: AppTheme.mutedText(context)),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Semantics(
                liveRegion: true,
                child: Text(error ?? '',
                    style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context).colorScheme.error)),
              ),
            ),
        ],
      ],
    );
  }
}

/// A read-only field that opens a picker.
class _PickerField extends StatelessWidget {
  const _PickerField({
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
    this.error = false,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback? onTap;
  final bool error;

  @override
  Widget build(BuildContext context) {
    final border = error
        ? OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusControl),
            borderSide: BorderSide(color: Theme.of(context).colorScheme.error))
        : null;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusControl),
      child: InputDecorator(
        isEmpty: false,
        decoration: InputDecoration(
          labelText: label,
          enabled: onTap != null,
          prefixIcon: Icon(icon, size: 18),
          enabledBorder: border,
        ),
        child: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
    );
  }
}
