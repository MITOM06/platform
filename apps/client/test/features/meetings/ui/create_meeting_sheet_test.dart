import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/widgets/pon_widgets.dart';
import 'package:platform_client/features/admin/state/capabilities_provider.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/data/my_departments_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_form.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/ui/create_meeting_sheet.dart';

import 'meeting_test_harness.dart';

class _Api implements MeetingsApi {
  final created = <MeetingInput>[];
  final updated = <MeetingInput>[];
  Object? failWith;

  @override
  Future<Meeting> create([MeetingInput input = const MeetingInput()]) async {
    created.add(input);
    final e = failWith;
    if (e != null) throw e;
    return sample(scheduled: input.scheduledStart != null);
  }

  @override
  Future<Meeting> update(String id, MeetingInput input) async {
    updated.add(input);
    return sample(scheduled: true);
  }

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Depts implements MyDepartmentsApi {
  _Depts(this.items);
  final List<DepartmentOption> items;
  @override
  Future<List<DepartmentOption>> list() async => items;
}

Meeting sample(
        {bool scheduled = false, MeetingStatus status = MeetingStatus.live}) =>
    Meeting(
        id: 'm1',
        code: 'abc-defg-hjk',
        title: 'Weekly',
        host: const MeetingPerson(userId: 'me'),
        scheduledStart: scheduled ? DateTime.utc(2030, 1, 1, 2) : null,
        scheduledEnd: scheduled ? DateTime.utc(2030, 1, 1, 3) : null,
        status: status,
        viewerRole: MeetingViewerRole.host,
        createdAt: DateTime.utc(2026, 10, 7));

DioException invalid(String field, int max) {
  final o = RequestOptions(path: '/api/meetings');
  return DioException(
      requestOptions: o,
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: 400, data: {
        'code': 'MEETING_INVALID',
        'params': {'field': field, 'max': max}
      }));
}

void main() {
  late _Api api;
  setUp(() => api = _Api());

  Future<void> open(WidgetTester tester,
      {MeetingFormMode mode = MeetingFormMode.create,
      Meeting? meeting,
      List<DepartmentOption> depts = const []}) async {
    await pumpMeetingWidget(
        tester,
        Builder(
            builder: (context) => TextButton(
                onPressed: () => CreateMeetingSheet.show(context,
                    mode: mode, meeting: meeting),
                child: const Text('open'))),
        overrides: [
          meetingsRepositoryProvider.overrideWithValue(api),
          myDepartmentsRepositoryProvider.overrideWithValue(_Depts(depts)),
          hasCapabilityProvider.overrideWith((ref, cap) => false),
        ]);
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  Future<void> tapOn(WidgetTester tester, Finder f) async {
    await tester.ensureVisible(f);
    await tester.pumpAndSettle();
    await tester.tap(f);
    await tester.pumpAndSettle();
  }

  Future<void> tapText(WidgetTester tester, String text) =>
      tapOn(tester, find.text(text));

  // "Start now" is both the segment and the submit label.
  Future<void> submit(WidgetTester tester, String label) => tapOn(tester,
      find.descendant(of: find.byType(PonButton), matching: find.text(label)));

  testWidgets('shows a server field error under the field instead of a banner',
      (tester) async {
    api.failWith = invalid('title', 120);
    await open(tester);
    await submit(tester, l10nOf(tester).meetingSubmitCreate);
    expect(api.created, hasLength(1));
    expect(find.text(l10nOf(tester).meetingValTitleTooLong(120)),
        findsOneWidget);
  });

  testWidgets(
      'starts an instant meeting and opens the room when "Start now" is picked',
      (tester) async {
    await open(tester);
    await tapOn(
        tester,
        find.descendant(
            of: find.byType(SegmentedButton<bool>),
            matching: find.text(l10nOf(tester).meetingWhenNow)));
    await submit(tester, l10nOf(tester).meetingSubmitStartNow);
    expect(api.created.single.scheduledStart, isNull);
    expect(find.text('/meet/abc-defg-hjk'), findsOneWidget);
  });

  testWidgets('a scheduled meeting is created with a UTC schedule',
      (tester) async {
    await open(tester);
    await submit(tester, l10nOf(tester).meetingSubmitCreate);
    final input = api.created.single;
    expect(input.scheduledStart, isNotNull);
    expect(input.toJson()['scheduledStart'], endsWith('Z'));
    expect(find.text(l10nOf(tester).meetingFormCreateTitle), findsNothing);
  });

  testWidgets('offers the caller departments only when there are some',
      (tester) async {
    await open(tester,
        depts: const [DepartmentOption(id: 'd1', name: 'Sales')]);
    expect(find.text(l10nOf(tester).meetingFieldDepartment), findsOneWidget);
  });

  testWidgets('hides the department field for someone without departments',
      (tester) async {
    await open(tester);
    expect(find.text(l10nOf(tester).meetingFieldDepartment), findsNothing);
  });

  testWidgets('editing sends only the switch that was flipped',
      (tester) async {
    await open(tester,
        mode: MeetingFormMode.edit,
        meeting: sample(scheduled: true, status: MeetingStatus.scheduled));
    expect(find.text(l10nOf(tester).meetingWhenNow), findsNothing);
    await tapText(tester, l10nOf(tester).meetingSettingLocked);
    await submit(tester, l10nOf(tester).meetingSubmitSave);
    expect(api.updated.single.toJson()['settings'], {'locked': true});
    expect(api.updated.single.toJson().containsKey('scheduledStart'), isFalse);
  });
}
