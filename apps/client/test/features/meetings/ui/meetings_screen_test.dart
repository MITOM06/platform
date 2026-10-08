import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/state/capabilities_provider.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/data/my_departments_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/ui/meetings_screen.dart';
import 'package:platform_client/features/meetings/ui/widgets/join_by_code_field.dart';

import 'meeting_test_harness.dart';

const rawId = '64b0aaaaaaaaaaaaaaaaaaaa';

Meeting live() => Meeting(
    id: 'm1',
    code: 'abc-defg-hjk',
    title: 'Weekly sync',
    host: const MeetingPerson(userId: rawId),
    status: MeetingStatus.live,
    viewerRole: MeetingViewerRole.invited,
    createdAt: DateTime.utc(2026, 10, 7));

class _Api implements MeetingsApi {
  final created = <MeetingInput>[];
  List<Meeting> upcoming = [live()];

  @override
  Future<MeetingPage> list(MeetingListScope scope,
          {String? cursor, int size = 20}) async =>
      scope == MeetingListScope.upcoming
          ? MeetingPage(content: upcoming, hasNext: false)
          : const MeetingPage(content: [], hasNext: false);

  @override
  Future<Meeting> create([MeetingInput input = const MeetingInput()]) async {
    created.add(input);
    return live();
  }

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _NoDepts implements MyDepartmentsApi {
  @override
  Future<List<DepartmentOption>> list() async => const [];
}

/// "Join" is also the row button's label — look inside the code field only.
Finder joinButton(String label) => find.descendant(
    of: find.byType(JoinByCodeField), matching: find.text(label));

void main() {
  late _Api api;
  setUp(() => api = _Api());

  Future<void> pump(WidgetTester tester, {bool canHost = false}) =>
      pumpMeetingWidget(tester, const MeetingsScreen(),
          wrapInScaffold: false,
          overrides: [
            meetingsRepositoryProvider.overrideWithValue(api),
            myDepartmentsRepositoryProvider.overrideWithValue(_NoDepts()),
            hasCapabilityProvider
                .overrideWith((ref, cap) => canHost && cap == Cap.hostMeeting),
          ]);

  testWidgets('offers Start now + Schedule only with HOST_MEETING',
      (tester) async {
    await pump(tester, canHost: true);
    final l = l10nOf(tester);
    expect(find.text(l.meetingNewInstant), findsOneWidget);
    expect(find.text(l.meetingNewScheduled), findsOneWidget);
    expect(joinButton(l.meetingJoinByCode), findsOneWidget);
  });

  testWidgets('without HOST_MEETING only joining by code is offered',
      (tester) async {
    await pump(tester);
    final l = l10nOf(tester);
    expect(find.text(l.meetingNewInstant), findsNothing);
    expect(find.text(l.meetingNewScheduled), findsNothing);
    expect(joinButton(l.meetingJoinByCode), findsOneWidget);
  });

  testWidgets('"Start now" creates an instant meeting and opens it',
      (tester) async {
    await pump(tester, canHost: true);
    await tester.tap(find.text(l10nOf(tester).meetingNewInstant));
    await tester.pumpAndSettle();
    expect(api.created.single.toJson(), isEmpty);
    expect(find.text('/meet/abc-defg-hjk'), findsOneWidget);
  });

  testWidgets('joins by a pasted code in any case and spacing', (tester) async {
    await pump(tester);
    await tester.enterText(find.byType(TextField), 'ABC DEFG HJK');
    await tester.pump();
    await tester.tap(joinButton(l10nOf(tester).meetingJoinByCode));
    await tester.pumpAndSettle();
    expect(find.text('/meet/abc-defg-hjk'), findsOneWidget);
  });

  testWidgets('rejects a malformed code under the field', (tester) async {
    await pump(tester);
    await tester.enterText(find.byType(TextField), 'abc');
    await tester.pump();
    await tester.tap(joinButton(l10nOf(tester).meetingJoinByCode));
    await tester.pumpAndSettle();
    expect(find.text(l10nOf(tester).meetingCodeInvalid), findsOneWidget);
  });

  testWidgets('lists meetings with their status and never a raw host id',
      (tester) async {
    await pump(tester);
    final l = l10nOf(tester);
    expect(find.text('Weekly sync'), findsOneWidget);
    expect(find.text(l.meetingStatusLive), findsOneWidget);
    expect(find.textContaining('64b0'), findsNothing);
    expect(find.textContaining(l.meetingSomeone), findsOneWidget);
    await tester.tap(find.text('Weekly sync'));
    await tester.pumpAndSettle();
    expect(find.text('/meetings/m1'), findsOneWidget);
  });

  testWidgets('shows the empty Past list', (tester) async {
    await pump(tester);
    await tester.tap(find.text(l10nOf(tester).meetingTabPast));
    await tester.pumpAndSettle();
    expect(find.text(l10nOf(tester).meetingEmptyPast), findsOneWidget);
  });

  testWidgets('a scheduled meeting can be joined from its row, like on web',
      (tester) async {
    api.upcoming = [
      Meeting(
          id: 'm2',
          code: 'xyz-wxyz-wxy',
          title: 'Planning',
          host: const MeetingPerson(userId: 'h', displayName: 'Lan'),
          status: MeetingStatus.scheduled,
          scheduledStart: DateTime.now().add(const Duration(days: 1)),
          viewerRole: MeetingViewerRole.invited,
          createdAt: DateTime.utc(2026, 10, 7)),
    ];
    await pump(tester);
    final l = l10nOf(tester);
    final row = find.ancestor(
        of: find.text('Planning'), matching: find.byType(InkWell));
    final join =
        find.descendant(of: row.first, matching: find.text(l.meetingJoin));
    expect(join, findsOneWidget);
    await tester.tap(join);
    await tester.pumpAndSettle();
    expect(find.text('/meet/xyz-wxyz-wxy'), findsOneWidget);
  });
}
