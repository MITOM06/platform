import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/state/capabilities_provider.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/data/my_departments_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/ui/meeting_detail_screen.dart';

import 'meeting_test_harness.dart';

const rawId = '64b0aaaaaaaaaaaaaaaaaaaa';

Meeting meeting({
  MeetingStatus status = MeetingStatus.live,
  MeetingViewerRole viewerRole = MeetingViewerRole.invited,
  MeetingPerson host = const MeetingPerson(userId: 'h', displayName: 'Lan'),
  DateTime? scheduledStart,
  DateTime? endedAt,
  List<String> removedIds = const [],
  List<MeetingPerson> invitees = const [],
}) =>
    Meeting(
        id: 'm1',
        code: 'abc-defg-hjk',
        title: 'Weekly',
        host: host,
        invitees: invitees,
        scheduledStart: scheduledStart,
        status: status,
        removedIds: removedIds,
        viewerRole: viewerRole,
        endedAt: endedAt,
        createdAt: DateTime.utc(2026, 10, 8));

DioException failure(int status, String code) {
  final o = RequestOptions(path: '/api/meetings/m1');
  return DioException(
      requestOptions: o,
      type: DioExceptionType.badResponse,
      response: Response(
          requestOptions: o,
          statusCode: status,
          data: {'code': code, 'statusCode': status}));
}

class _Api implements MeetingsApi {
  Object? getResult;
  Object messagesResult = const MeetingMessagePage(content: [], hasNext: false);

  @override
  Future<Meeting> get(String id) async {
    final r = getResult;
    if (r is Meeting) return r;
    throw r ?? StateError('no meeting');
  }

  @override
  Future<MeetingMessagePage> messages(String id,
      {String? before, int size = 50}) async {
    final r = messagesResult;
    if (r is MeetingMessagePage) return r;
    throw r;
  }

  @override
  Future<MeetingNote> getNote(String id, NoteScope scope) async =>
      MeetingNote(scope: scope, content: 'agenda', version: 1);

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _NoDepts implements MyDepartmentsApi {
  @override
  Future<List<DepartmentOption>> list() async => const [];
}

void main() {
  late _Api api;
  setUp(() => api = _Api());

  Future<void> pump(WidgetTester tester) => pumpMeetingWidget(
        tester,
        const MeetingDetailScreen(meetingId: 'm1'),
        wrapInScaffold: false,
        overrides: [
          meetingsRepositoryProvider.overrideWithValue(api),
          myDepartmentsRepositoryProvider.overrideWithValue(_NoDepts()),
          hasCapabilityProvider.overrideWith((ref, cap) => true),
        ],
      );

  testWidgets('replaces the records with a calm notice for a removed viewer',
      (tester) async {
    api.getResult = meeting();
    api.messagesResult = failure(403, 'MEETING_REMOVED');
    await pump(tester);
    final l = l10nOf(tester);
    expect(find.text(l.meetingRemovedNotice), findsOneWidget);
    expect(find.text(l.meetingSectionNotes), findsNothing);
    expect(find.text(l.meetingErrRemoved), findsNothing);
  });

  testWidgets('tells a guest of a live meeting to join to see the records',
      (tester) async {
    api.getResult = meeting(viewerRole: MeetingViewerRole.guest);
    api.messagesResult = failure(403, 'MEETING_FORBIDDEN');
    await pump(tester);
    final l = l10nOf(tester);
    expect(find.text(l.meetingGuestNotice), findsOneWidget);
    expect(find.text(l.meetingSectionNotes), findsNothing);
  });

  testWidgets('shows the records to a guest who attended', (tester) async {
    api.getResult = meeting(
        viewerRole: MeetingViewerRole.guest,
        status: MeetingStatus.ended,
        endedAt: DateTime.utc(2026, 10, 8, 2));
    api.messagesResult = MeetingMessagePage(content: [
      MeetingChatMessage(
          id: 'x1',
          sender: const MeetingPerson(userId: 'a', displayName: 'An'),
          content: 'see you',
          createdAt: DateTime.utc(2026, 10, 8, 1)),
    ], hasNext: false);
    await pump(tester);
    final l = l10nOf(tester);
    await tester.scrollUntilVisible(find.text('see you'), 200,
        scrollable: find.byType(Scrollable).first);
    expect(find.text('see you'), findsOneWidget);
    expect(find.text(l.meetingSectionChat), findsOneWidget);
    expect(find.text(l.meetingSectionNotes), findsOneWidget);
    expect(find.text(l.meetingGuestNotice), findsNothing);
  });

  testWidgets('offers host actions and never renders raw ids', (tester) async {
    api.getResult = meeting(
      status: MeetingStatus.scheduled,
      viewerRole: MeetingViewerRole.host,
      host: const MeetingPerson(userId: rawId),
      scheduledStart: DateTime.utc(2030, 10, 9, 2),
      removedIds: const [rawId],
      invitees: const [MeetingPerson(userId: rawId, displayName: rawId)],
    );
    await pump(tester);
    final l = l10nOf(tester);
    expect(find.text(l.meetingJoin), findsOneWidget);
    expect(find.text(l.meetingEdit), findsOneWidget);
    expect(find.text(l.meetingCancelMeeting), findsOneWidget);
    expect(find.text(l.meetingParticipantFallback), findsNWidgets(2)); // web label
    expect(find.textContaining('64b0'), findsNothing);
    // SCHEDULED and nobody joined yet: no attendance section.
    expect(find.text(l.meetingSectionAttendance), findsNothing);
  });

  testWidgets('shows "not found" without a retry for a missing meeting',
      (tester) async {
    api.getResult = failure(404, 'MEETING_NOT_FOUND');
    await pump(tester);
    final l = l10nOf(tester);
    expect(find.text(l.meetingErrNotFound), findsOneWidget);
    expect(find.text(l.actionRetry), findsNothing);
  });

  testWidgets('offers a retry for other load failures', (tester) async {
    api.getResult = failure(500, 'BOOM');
    await pump(tester);
    final l = l10nOf(tester);
    expect(find.text(l.meetingDetailError), findsOneWidget);
    expect(find.text(l.actionRetry), findsOneWidget);
    expect(find.textContaining('BOOM'), findsNothing);
  });
}
