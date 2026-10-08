// One note tab (shared / private) of one meeting — mirror of web
// `lib/hooks/use-note-editor.ts`: load, reducer (`note_sync.dart`), autosave
// 2 s after the last change, refetch when a newer version can be loaded
// without losing text, and a best-effort save when the editor goes away.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/meetings_repository.dart';
import '../domain/meeting_errors.dart';
import '../domain/meeting_models.dart';
import '../domain/note_sync.dart';

typedef NoteKey = ({String meetingId, NoteScope scope});

/// Autosave fires this long after the last keystroke (tests override it).
final noteAutosaveDelayProvider =
    Provider<Duration>((_) => const Duration(seconds: 2));

class NoteEditorView {
  const NoteEditorView({required this.note, this.loadError});

  final NoteState note;

  /// The note could not be loaded (403 removed / guest, network…).
  final MeetingErrorInfo? loadError;
}

class NoteEditorNotifier
    extends AutoDisposeFamilyNotifier<NoteEditorView, NoteKey> {
  late MeetingsApi _api;
  late Duration _delay;
  Timer? _timer;
  bool _saving = false;
  bool _refetching = false;
  bool _canEdit = true;
  bool _disposed = false;

  /// Mirror of [state] readable from `onDispose`.
  NoteState _note = NoteState.initial;

  @override
  NoteEditorView build(NoteKey arg) {
    _api = ref.read(meetingsRepositoryProvider);
    _delay = ref.read(noteAutosaveDelayProvider);
    final api = _api;
    ref.onDispose(() {
      _disposed = true;
      _timer?.cancel();
      // Leaving with unsaved text: best-effort save (nobody listens to the
      // answer any more).
      if (_canEdit && canAutosave(_note) && !_saving) {
        final p = savePayload(_note);
        unawaited(api
            .putNote(arg.meetingId, arg.scope,
                content: p.content, version: p.version)
            .then((_) {}, onError: (Object _) {}));
      }
    });
    unawaited(_load());
    return const NoteEditorView(note: NoteState.initial);
  }

  Future<void> _load() async {
    try {
      final note = await _api.getNote(arg.meetingId, arg.scope);
      if (_disposed) return;
      _dispatch(Loaded(note));
    } catch (e) {
      if (_disposed) return;
      state = NoteEditorView(note: _note, loadError: parseMeetingError(e));
    }
  }

  void _dispatch(NoteAction a) {
    if (_disposed) return;
    final prev = _note;
    final next = noteReducer(prev, a);
    if (identical(next, prev)) return;
    _note = next;
    state = NoteEditorView(note: next, loadError: state.loadError);
    _reschedule(prev, next);
    if (needsRefetch(next) && !_refetching) unawaited(_refetch());
  }

  /// Web effect deps: [autosave, draft] — restart on a new draft, stop when
  /// autosave turns off.
  void _reschedule(NoteState prev, NoteState next) {
    final auto = canAutosave(next) && _canEdit;
    if (!auto) {
      _timer?.cancel();
      _timer = null;
      return;
    }
    final wasAuto = canAutosave(prev) && _canEdit;
    if (_timer == null || !wasAuto || prev.draft != next.draft) {
      _timer?.cancel();
      _timer = Timer(_delay, () => unawaited(_save()));
    }
  }

  Future<void> _refetch() async {
    _refetching = true;
    try {
      final note = await _api.getNote(arg.meetingId, arg.scope);
      _dispatch(Loaded(note));
    } catch (_) {
      // The flag stays; the next remote signal or reopening retries.
    } finally {
      _refetching = false;
    }
  }

  Future<void> _save() async {
    _timer?.cancel();
    _timer = null;
    final current = _note;
    if (_saving || _disposed || !canAutosave(current)) return;
    _saving = true;
    _dispatch(const SaveStarted());
    final p = savePayload(current);
    try {
      final note = await _api.putNote(arg.meetingId, arg.scope,
          content: p.content, version: p.version);
      _dispatch(SaveSucceeded(note));
    } catch (e) {
      final latest = noteConflictLatest(e);
      _dispatch(latest != null
          ? SaveConflicted(latest)
          : SaveFailed(meetingErrorNotice(
              parseMeetingError(e), MeetingErrorContext.note)));
    } finally {
      _saving = false;
    }
  }

  /// false ⇒ no autosave (role / `attendeesCanEditNotes` changed mid-meeting).
  void setCanEdit(bool v) {
    if (_canEdit == v) return;
    _canEdit = v;
    _reschedule(_note, _note);
  }

  void edit(String draft) => _dispatch(Edit(draft));
  void retry() => _dispatch(const RetrySave());
  void keepMine() => _dispatch(const KeepMine());
  void takeTheirs() => _dispatch(const TakeTheirs());
  void saveMerged(String draft) => _dispatch(SaveMerged(draft));

  /// `meet.notes.updated` (in the room); a clean editor then reloads.
  void remoteUpdated(int version, MeetingPerson? by) =>
      _dispatch(RemoteUpdated(version, by));

  /// Save now if dirty (closing the panel, leaving the room).
  Future<void> flush() async {
    if (!_canEdit) return;
    await _save();
  }
}

final noteEditorProvider = NotifierProvider.autoDispose
    .family<NoteEditorNotifier, NoteEditorView, NoteKey>(
        NoteEditorNotifier.new);
