// NoteEditorNotifier: load, autosave after the debounce, conflict / failure
// handling, remote-update refetch, resync and the best-effort save on dispose.


import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:platform_client/features/meetings/data/meetings_repository.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/note_sync.dart';
import 'package:platform_client/features/meetings/state/note_editor.dart';

class _Api extends Mock implements MeetingsApi {}

MeetingNote _note(int v, String c) =>
    MeetingNote(scope: NoteScope.shared, content: c, version: v);

DioException _http(int status, [Object? body]) {
  final o = RequestOptions(path: '/x');
  return DioException(
      requestOptions: o,
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: status, data: body));
}

const NoteKey _key = (meetingId: 'm1', scope: NoteScope.shared);

Future<void> _settle() async {
  for (var i = 0; i < 5; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  late _Api api;
  late ProviderContainer c;
  late ProviderSubscription<NoteEditorView> sub;

  setUpAll(() => registerFallbackValue(NoteScope.shared));

  setUp(() {
    api = _Api();
    c = ProviderContainer(overrides: [
      meetingsRepositoryProvider.overrideWithValue(api),
      noteAutosaveDelayProvider.overrideWithValue(Duration.zero),
    ]);
  });
  tearDown(() => c.dispose());

  NoteEditorNotifier open() {
    sub = c.listen(noteEditorProvider(_key), (_, __) {});
    return c.read(noteEditorProvider(_key).notifier);
  }

  NoteState note() => c.read(noteEditorProvider(_key)).note;

  test('loads the note', () async {
    when(() => api.getNote('m1', NoteScope.shared))
        .thenAnswer((_) async => _note(3, 'hello'));
    open();
    await _settle();
    expect(note().status, NoteStatus.clean);
    expect(note().draft, 'hello');
    expect(note().baseVersion, 3);
  });

  test('a failed load exposes a loadError', () async {
    when(() => api.getNote(any(), any()))
        .thenAnswer((_) async => throw _http(403, {'code': 'FORBIDDEN'}));
    open();
    await _settle();
    expect(c.read(noteEditorProvider(_key)).loadError, isNotNull);
    expect(note().status, NoteStatus.loading);
  });

  test('editing autosaves with the base version', () async {
    when(() => api.getNote(any(), any())).thenAnswer((_) async => _note(1, 'a'));
    when(() => api.putNote('m1', NoteScope.shared, content: 'ab', version: 1))
        .thenAnswer((_) async => _note(2, 'ab'));
    final n = open();
    await _settle();
    n.edit('ab');
    expect(note().status, NoteStatus.dirty);
    await _settle();
    verify(() => api.putNote('m1', NoteScope.shared, content: 'ab', version: 1))
        .called(1);
    expect(note().status, NoteStatus.saved);
    expect(note().baseVersion, 2);
  });

  test('a 409 conflict keeps the draft and exposes the latest version',
      () async {
    when(() => api.getNote(any(), any())).thenAnswer((_) async => _note(1, 'a'));
    when(() => api.putNote(any(), any(),
            content: any(named: 'content'), version: any(named: 'version')))
        .thenThrow(_http(409, {
      'code': 'MEETING_NOTE_CONFLICT',
      'latest': {'scope': 'shared', 'content': 'theirs', 'version': 4},
    }));
    final n = open();
    await _settle();
    n.edit('mine');
    await _settle();
    expect(note().status, NoteStatus.conflict);
    expect(note().draft, 'mine');
    expect(note().latest?.content, 'theirs');

    // Merge: rebases on v4 with the merged text, then autosaves it.
    when(() => api.putNote('m1', NoteScope.shared, content: 'merged', version: 4))
        .thenAnswer((_) async => _note(5, 'merged'));
    n.saveMerged('merged');
    await _settle();
    expect(note().baseVersion, 5);
    expect(note().status, NoteStatus.saved);
  });

  test('a non-conflict failure → error; retry saves again', () async {
    when(() => api.getNote(any(), any())).thenAnswer((_) async => _note(1, 'a'));
    var calls = 0;
    when(() => api.putNote(any(), any(),
            content: any(named: 'content'), version: any(named: 'version')))
        .thenAnswer((_) async {
      calls++;
      if (calls == 1) throw _http(500);
      return _note(2, 'b');
    });
    final n = open();
    await _settle();
    n.edit('b');
    await _settle();
    expect(note().status, NoteStatus.error);
    expect(note().error, isNotNull);
    n.retry();
    await _settle();
    expect(calls, 2);
    expect(note().status, NoteStatus.saved);
  });

  test('setCanEdit(false) stops autosave; flush is then a no-op', () async {
    when(() => api.getNote(any(), any())).thenAnswer((_) async => _note(1, 'a'));
    final n = open();
    await _settle();
    n.setCanEdit(false);
    n.edit('b');
    await _settle();
    await n.flush();
    verifyNever(() => api.putNote(any(), any(),
        content: any(named: 'content'), version: any(named: 'version')));
    expect(note().status, NoteStatus.dirty);
  });

  test('a remote update on a clean editor refetches', () async {
    var v = 1;
    when(() => api.getNote(any(), any()))
        .thenAnswer((_) async => _note(v, 'v$v'));
    final n = open();
    await _settle();
    v = 2;
    n.remoteUpdated(2, const MeetingPerson(userId: 'u2'));
    await _settle();
    expect(note().baseVersion, 2);
    expect(note().draft, 'v2');
    verify(() => api.getNote('m1', NoteScope.shared)).called(2);
  });

  test('resyncIfClean reloads only a clean editor', () async {
    when(() => api.getNote(any(), any())).thenAnswer((_) async => _note(1, 'a'));
    final n = open();
    await _settle();
    n.resyncIfClean();
    await _settle();
    verify(() => api.getNote('m1', NoteScope.shared)).called(2);

    n.setCanEdit(false);
    n.edit('dirty');
    n.resyncIfClean();
    await _settle();
    verifyNever(() => api.getNote('m1', NoteScope.shared));
  });

  test('a failed refetch is swallowed (state unchanged)', () async {
    var n = 0;
    when(() => api.getNote(any(), any())).thenAnswer((_) async {
      n++;
      if (n > 1) throw _http(503);
      return _note(1, 'a');
    });
    final editor = open();
    await _settle();
    editor.resyncIfClean();
    await _settle();
    expect(note().draft, 'a');
    expect(n, 2);
  });

  test('closing with unsaved text sends a best-effort save', () async {
    when(() => api.getNote(any(), any())).thenAnswer((_) async => _note(1, 'a'));
    when(() => api.putNote(any(), any(),
            content: any(named: 'content'), version: any(named: 'version')))
        .thenAnswer((_) async => throw _http(500));
    c.updateOverrides([
      meetingsRepositoryProvider.overrideWithValue(api),
      noteAutosaveDelayProvider.overrideWithValue(const Duration(hours: 1)),
    ]);
    final editor = open();
    await _settle();
    editor.edit('unsaved');
    sub.close();
    await _settle();
    verify(() => api.putNote('m1', NoteScope.shared,
        content: 'unsaved', version: 1)).called(1);
  });

  test('keepMine / takeTheirs resolve a conflict', () async {
    when(() => api.getNote(any(), any())).thenAnswer((_) async => _note(1, 'a'));
    when(() => api.putNote(any(), any(),
            content: any(named: 'content'), version: any(named: 'version')))
        .thenThrow(_http(409, {
      'code': 'MEETING_NOTE_CONFLICT',
      'latest': {'scope': 'shared', 'content': 'theirs', 'version': 4},
    }));
    final n = open();
    await _settle();
    n.setCanEdit(true);
    n.edit('mine');
    await _settle();
    expect(note().status, NoteStatus.conflict);
    n.setCanEdit(false); // no autosave loop while resolving
    n.takeTheirs();
    expect(note().draft, 'theirs');
    expect(note().baseVersion, 4);
    expect(note().status, NoteStatus.clean);
  });
}
