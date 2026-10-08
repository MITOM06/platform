import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/meeting_code.dart';
import '../domain/meeting_errors.dart';
import '../domain/meeting_form.dart';
import '../domain/meeting_models.dart';
import '../domain/meeting_text.dart';
import '../domain/schedule.dart';
import '../state/meetings_providers.dart';
import 'meeting_text_l10n.dart';
import 'widgets/invitee_picker.dart';
import 'widgets/meeting_department_field.dart';
import 'widgets/meeting_schedule_fields.dart';
import 'widgets/meeting_settings_fields.dart';
import 'widgets/meeting_text_fields.dart';

/// Server `MEETING_INVALID.params.field` → the form field that shows it inline
/// (web `SERVER_FIELDS`).
const _serverFields = {
  'title': MeetingFormField.title,
  'description': MeetingFormField.description,
  'inviteeIds': MeetingFormField.invitees,
  'scheduledStart': MeetingFormField.schedule,
  'scheduledEnd': MeetingFormField.schedule,
};

/// Schedule / edit / meet again — mirror of web `MeetingFormDialog`, as a
/// scrolling bottom sheet. Form state is local to the sheet.
class CreateMeetingSheet extends ConsumerStatefulWidget {
  const CreateMeetingSheet(
      {super.key, required this.mode, this.meeting, required this.now});

  final MeetingFormMode mode;
  final Meeting? meeting;

  /// Taken when the sheet opened.
  final DateTime now;

  /// Opens the sheet; an instant meeting created from it opens its room.
  static Future<void> show(BuildContext context,
      {required MeetingFormMode mode, Meeting? meeting}) async {
    final started = await showModalBottomSheet<Meeting>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) =>
          CreateMeetingSheet(mode: mode, meeting: meeting, now: DateTime.now()),
    );
    if (started != null && context.mounted) {
      context.push(meetingPath(started.code));
    }
  }

  @override
  ConsumerState<CreateMeetingSheet> createState() => _CreateMeetingSheetState();
}

class _CreateMeetingSheetState extends ConsumerState<CreateMeetingSheet> {
  static const _zone = DeviceZone();
  late MeetingFormValues _values = _initialValues();
  DateTime? _checkedAt;
  Map<MeetingFormField, MeetingNotice> _serverErrors = const {};
  bool _pending = false;

  /// The meeting being edited (as the sheet opened it) — edits send only what
  /// changed against it.
  Meeting? get _original =>
      widget.mode == MeetingFormMode.edit ? widget.meeting : null;

  MeetingFormValues _initialValues() {
    final m = widget.meeting;
    if (m != null && widget.mode != MeetingFormMode.create) {
      return formFromMeeting(m, widget.mode, widget.now, _zone);
    }
    return emptyMeetingForm(widget.now, _zone).copyWith(scheduled: true);
  }

  void _patch(MeetingFormField? field, MeetingFormValues next) {
    setState(() {
      _values = next;
      if (field != null && _serverErrors.containsKey(field)) {
        _serverErrors = Map.of(_serverErrors)..remove(field);
      }
    });
  }

  Future<void> _submit() async {
    final l10n = context.l10n;
    final at = DateTime.now();
    final original = _original;
    setState(() => _checkedAt = at);
    if (validateMeetingForm(_values, at, _zone, original: original)
        .isNotEmpty) {
      return;
    }
    final actions = ref.read(meetingActionsProvider);
    final input = toMeetingInput(_values, _zone, original: original);
    setState(() => _pending = true);
    try {
      if (original != null) {
        await actions.update(original.id, input);
        if (!mounted) return;
        showInfoSnackBar(l10n.meetingToastUpdated);
        Navigator.of(context).pop();
        return;
      }
      final m = await actions.create(input);
      if (!mounted) return;
      if (_values.scheduled) {
        showInfoSnackBar(l10n.meetingToastCreated);
        Navigator.of(context).pop();
      } else {
        Navigator.of(context).pop(m);
      }
    } catch (e) {
      _onError(l10n, e);
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  void _onError(AppLocalizations l10n, Object e) {
    final info = parseMeetingError(e);
    final field = info.code == 'MEETING_INVALID'
        ? _serverFields[info.params?['field']]
        : null;
    if (field != null && mounted) {
      setState(() => _serverErrors = {
            ..._serverErrors,
            field: meetingErrorNotice(info),
          });
      return;
    }
    // MEETING_CREATE_FORBIDDEN: MeetingActions.create refreshed capabilities.
    showErrorSnackBar(meetingErrorText(l10n, e));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final checkedAt = _checkedAt;
    final errors = {
      if (checkedAt != null)
        ...validateMeetingForm(_values, checkedAt, _zone, original: _original),
      ..._serverErrors,
    };
    String? msg(MeetingFormField f) =>
        switch (errors[f]) { final n? => meetingText(l10n, n), null => null };
    final departments = ref.watch(meetingDepartmentOptionsProvider);
    final showDepartment = departments.isNotEmpty &&
        (_values.departmentId.isEmpty ||
            departments.any((d) => d.id == _values.departmentId));
    final submitLabel = _original != null
        ? l10n.meetingSubmitSave
        : _values.scheduled
            ? l10n.meetingSubmitCreate
            : l10n.meetingSubmitStartNow;
    final media = MediaQuery.of(context);
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: media.size.height * 0.92),
      child: Padding(
        padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          _SheetHeader(title: switch (widget.mode) {
            MeetingFormMode.create => l10n.meetingFormCreateTitle,
            MeetingFormMode.edit => l10n.meetingFormEditTitle,
            MeetingFormMode.again => l10n.meetingFormAgainTitle,
          }),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  MeetingTextFields(
                    title: _values.title,
                    description: _values.description,
                    onTitle: (v) => _patch(MeetingFormField.title,
                        _values.copyWith(title: v)),
                    onDescription: (v) => _patch(MeetingFormField.description,
                        _values.copyWith(description: v)),
                    titleError: msg(MeetingFormField.title),
                    descriptionError: msg(MeetingFormField.description),
                  ),
                  const SizedBox(height: 20),
                  MeetingScheduleFields(
                    scheduled: _values.scheduled,
                    schedule: _values.schedule,
                    onScheduledChange: (v) => _patch(MeetingFormField.schedule,
                        _values.copyWith(scheduled: v)),
                    onScheduleChange: (v) => _patch(MeetingFormField.schedule,
                        _values.copyWith(schedule: v)),
                    allowNow: _original?.scheduledStart == null,
                    disabled: _original?.status == MeetingStatus.live,
                    error: msg(MeetingFormField.schedule),
                    now: widget.now,
                  ),
                  const SizedBox(height: 20),
                  InviteePicker(
                    invitees: _values.invitees,
                    onChanged: (v) => _patch(MeetingFormField.invitees,
                        _values.copyWith(invitees: v)),
                    error: msg(MeetingFormField.invitees),
                  ),
                  if (showDepartment) ...[
                    const SizedBox(height: 20),
                    MeetingDepartmentField(
                      value: _values.departmentId,
                      departments: departments,
                      onChanged: (v) =>
                          _patch(null, _values.copyWith(departmentId: v)),
                    ),
                  ],
                  const SizedBox(height: 20),
                  MeetingSettingsFields(
                    settings: _values.settings,
                    onChanged: (v) =>
                        _patch(null, _values.copyWith(settings: v)),
                  ),
                ],
              ),
            ),
          ),
          _SheetFooter(
            submitLabel: submitLabel,
            pending: _pending,
            onSubmit: _submit,
          ),
        ]),
      ),
    );
  }
}

class _SheetHeader extends StatelessWidget {
  const _SheetHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 4, 4),
        child: Row(children: [
          Expanded(
            child: Text(title,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          ),
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
            icon: const Icon(Icons.close_rounded),
          ),
        ]),
      );
}

class _SheetFooter extends StatelessWidget {
  const _SheetFooter(
      {required this.submitLabel,
      required this.pending,
      required this.onSubmit});

  final String submitLabel;
  final bool pending;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(
            border: Border(top: BorderSide(color: AppTheme.hairline(context)))),
        child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(context.l10n.actionCancel),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: PonButton(
              onPressed: onSubmit,
              isLoading: pending,
              child: Text(submitLabel, overflow: TextOverflow.ellipsis),
            ),
          ),
        ]),
      );
}
