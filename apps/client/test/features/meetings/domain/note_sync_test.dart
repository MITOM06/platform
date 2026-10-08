import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_text.dart';
import 'package:platform_client/features/meetings/domain/note_sync.dart';

MeetingNote note(String content, int version, [String by = 'Minh']) =>
    MeetingNote(
        scope: NoteScope.shared,
        content: content,
        version: version,
        updatedBy: MeetingPerson(userId: 'u2', displayName: by));
NoteState run(List<NoteAction> actions) =>
    actions.fold(NoteState.initial, noteReducer);

void main() {
  test('loads a note as clean', () {
    final s = run([Loaded(note('base', 1))]);
    expect((s.status, s.baseVersion, s.baseContent, s.draft),
        (NoteStatus.clean, 1, 'base', 'base'));
    expect(canAutosave(s), isFalse);
  });

  test('becomes dirty on edit and clean again when the edit is undone', () {
    final dirty = run([Loaded(note('base', 1)), const Edit('base!')]);
    expect(dirty.status, NoteStatus.dirty);
    expect(canAutosave(dirty), isTrue);
    expect(savePayload(dirty), (content: 'base!', version: 1));
    expect(noteReducer(dirty, const Edit('base')).status, NoteStatus.clean);
  });

  test('keeps typing that happens while a save is in flight', () {
    final s = run([
      Loaded(note('a', 1)),
      const Edit('ab'),
      const SaveStarted(),
      const Edit('abc'),
      SaveSucceeded(note('ab', 2))
    ]);
    expect((s.status, s.baseVersion, s.baseContent, s.draft),
        (NoteStatus.dirty, 2, 'ab', 'abc'));
    expect(savePayload(s), (content: 'abc', version: 2));
  });

  test(
      'marks a save as saved when nothing changed meanwhile; the echo changes nothing',
      () {
    final s = run([
      Loaded(note('a', 1)),
      const Edit('ab'),
      const SaveStarted(),
      SaveSucceeded(note('ab', 2))
    ]);
    expect((s.status, s.baseVersion, s.draft), (NoteStatus.saved, 2, 'ab'));
    expect(identical(noteReducer(s, Loaded(note('ab', 2))), s), isTrue);
  });

  group('409 conflict', () {
    final conflicted = run([
      Loaded(note('base', 1)),
      const Edit('base + mine'),
      const SaveStarted(),
      SaveConflicted(note('base + theirs', 2))
    ]);

    test('never loses the text being typed', () {
      expect((conflicted.status, conflicted.draft, conflicted.baseVersion),
          (NoteStatus.conflict, 'base + mine', 1));
      expect(conflicted.latest?.content, 'base + theirs');
      expect(canAutosave(conflicted), isFalse);
      expect(hasUnsavedText(conflicted), isTrue);
      final typing = noteReducer(conflicted, const Edit('base + mine!'));
      expect(
          (typing.status, typing.draft), (NoteStatus.conflict, 'base + mine!'));
    });

    test(
        '"keep mine" rebases the draft on the newer version so the next save overwrites it',
        () {
      final s = noteReducer(conflicted, const KeepMine());
      expect((s.status, s.baseVersion, s.baseContent, s.draft, s.latest),
          (NoteStatus.dirty, 2, 'base + theirs', 'base + mine', null));
      expect(savePayload(s), (content: 'base + mine', version: 2));
    });

    test('"use newer version" adopts their text', () {
      final s = noteReducer(conflicted, const TakeTheirs());
      expect((s.status, s.baseVersion, s.draft, s.latest),
          (NoteStatus.clean, 2, 'base + theirs', null));
    });

    test('"save merged" saves the merged text on top of the newer version', () {
      final s = noteReducer(conflicted, const SaveMerged('base + theirs + mine'));
      expect((s.status, s.baseVersion, s.draft),
          (NoteStatus.dirty, 2, 'base + theirs + mine'));
      expect(savePayload(s), (content: 'base + theirs + mine', version: 2));
    });

    test('a reload during the conflict does not touch the draft', () {
      final s =
          noteReducer(conflicted, Loaded(note('base + theirs + more', 3)));
      expect((s.status, s.draft), (NoteStatus.conflict, 'base + mine'));
      expect(
          s.remoteNewer,
          const RemoteNewer(
              3, MeetingPerson(userId: 'u2', displayName: 'Minh')));
    });
  });

  group('remote updates (meet.notes.updated)', () {
    test('asks a clean editor to refetch, then applies the new version', () {
      final s = run([Loaded(note('a', 1)), const RemoteUpdated(2)]);
      expect(needsRefetch(s), isTrue);
      final after = noteReducer(s, Loaded(note('a+b', 2)));
      expect((after.status, after.draft, after.baseVersion, after.remoteNewer),
          (NoteStatus.clean, 'a+b', 2, null));
      expect(needsRefetch(after), isFalse);
    });

    test('only flags a dirty editor — its text stays', () {
      final s = run([
        Loaded(note('a', 1)),
        const Edit('mine'),
        const RemoteUpdated(2, MeetingPerson(userId: 'u2', displayName: 'Minh'))
      ]);
      expect((s.status, s.draft, s.remoteNewer?.updatedBy?.displayName),
          (NoteStatus.dirty, 'mine', 'Minh'));
      expect(needsRefetch(s), isFalse);
      expect(noteReducer(s, Loaded(note('theirs', 2))).draft, 'mine');
    });

    test('ignores its own echo and older versions', () {
      final s = run([Loaded(note('a', 3))]);
      expect(identical(noteReducer(s, const RemoteUpdated(3)), s), isTrue);
      expect(identical(noteReducer(s, const RemoteUpdated(2)), s), isTrue);
    });
  });

  test('a failed save keeps the text and can be retried', () {
    final failed = run([
      Loaded(note('a', 1)),
      const Edit('ab'),
      const SaveStarted(),
      const SaveFailed(MeetingNotice(MeetingText.errNetwork))
    ]);
    expect((failed.status, failed.draft, failed.error),
        (NoteStatus.error, 'ab', const MeetingNotice(MeetingText.errNetwork)));
    expect(canAutosave(failed), isFalse);
    expect(noteReducer(failed, const RetrySave()).status, NoteStatus.dirty);
    final typed = noteReducer(failed, const Edit('abc'));
    expect((typed.status, typed.error), (NoteStatus.dirty, null));
  });
}
