import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/ui/widgets/notes_editor.dart';

import 'meeting_test_harness.dart';

class _Api implements MeetingsApi {
  final puts = <(String, int)>[];
  final replies = <Object>[]; // MeetingNote or an error to throw, in order
  @override
  Future<MeetingNote> getNote(String id, NoteScope scope) async =>
      MeetingNote(scope: scope, content: 'base', version: 1);
  @override
  Future<MeetingNote> putNote(String id, NoteScope scope,
      {required String content, required int version}) async {
    puts.add((content, version));
    final r = replies.isEmpty
        ? MeetingNote(scope: scope, content: content, version: version + 1)
        : replies.removeAt(0);
    if (r is MeetingNote) return r;
    throw r;
  }

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

DioException conflict(MeetingNote latest) {
  final o = RequestOptions(path: '/n');
  return DioException(
      requestOptions: o,
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: 409, data: {
        'code': 'MEETING_NOTE_CONFLICT',
        'latest': {
          'scope': 'shared',
          'content': latest.content,
          'version': latest.version,
          'updatedBy': {'userId': 'u2', 'displayName': 'Minh'}
        }
      }));
}

void main() {
  late _Api api;
  setUp(() => api = _Api());
  Future<void> pump(WidgetTester t,
          {bool canEdit = true,
          void Function(Future<void> Function())? onFlush}) =>
      pumpMeetingWidget(
          t,
          NotesEditor(
              meetingId: 'm1', canEditShared: canEdit, onFlushReady: onFlush),
          overrides: [meetingsRepositoryProvider.overrideWithValue(api)]);
  Finder box() => find.byType(TextField);

  testWidgets('autosaves 2 seconds after typing stops', (tester) async {
    await pump(tester);
    await tester.enterText(box(), 'base!');
    await tester.pump(const Duration(seconds: 1));
    expect(api.puts, isEmpty);
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(api.puts, [('base!', 1)]);
    expect(find.text(l10nOf(tester).meetingNotesSaved), findsOneWidget);
  });

  testWidgets(
      'on 409 keeps the typed text, explains, and "keep mine" saves over the newer version',
      (tester) async {
    api.replies.add(conflict(const MeetingNote(
        scope: NoteScope.shared, content: 'base theirs', version: 2)));
    await pump(tester);
    await tester.enterText(box(), 'base mine');
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    final l = l10nOf(tester);
    expect(find.text(l.meetingNotesConflictTitle), findsOneWidget);
    expect(tester.widget<TextField>(box()).controller!.text, 'base mine');
    await tester.tap(find.text(l.meetingNotesConflictReview));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.meetingNotesConflictKeepMine));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    expect(api.puts.last, ('base mine', 2));
    expect(tester.widget<TextField>(box()).controller!.text, 'base mine');
  });

  testWidgets('is read-only with an explanation when the user may not edit',
      (tester) async {
    await pump(tester, canEdit: false);
    expect(tester.widget<TextField>(box()).readOnly, isTrue);
    expect(find.text(l10nOf(tester).meetingNotesReadOnly), findsOneWidget);
  });

  testWidgets('hands the room a flush that saves unsaved text right away',
      (tester) async {
    Future<void> Function()? flush;
    await pump(tester, onFlush: (f) => flush = f);
    await tester.enterText(box(), 'base?');
    expect(flush, isNotNull);
    await tester.runAsync(() => flush!());
    expect(api.puts, [('base?', 1)]);
  });

  testWidgets('"use newer version" warns once, then replaces the text',
      (tester) async {
    api.replies.add(conflict(const MeetingNote(
        scope: NoteScope.shared, content: 'base theirs', version: 2)));
    await pump(tester);
    await tester.enterText(box(), 'base mine');
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    final l = l10nOf(tester);
    await tester.tap(find.text(l.meetingNotesConflictReview));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.meetingNotesConflictTakeTheirs));
    await tester.pumpAndSettle();
    expect(find.text(l.meetingNotesConflictDiscardWarning), findsOneWidget);
    await tester.tap(find.text(l.meetingNotesConflictTakeTheirs));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(box()).controller!.text, 'base theirs');
    expect(find.text(l.meetingNotesConflictTitle), findsNothing);
  });
}
