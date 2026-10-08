// Note editor state machine (shared + private meeting notes) — mirror of web
// `lib/meetings/note-sync.ts` 1-1.
//
// The one rule: what the user typed is never overwritten. Saves are
// optimistic-concurrency (`version`); a 409 keeps the draft and offers
// keep-mine / take-theirs / save-merged. Typing during a save stays as a new
// dirty draft on top of the saved version.

import 'meeting_models.dart';
import 'meeting_room_models.dart';
import 'meeting_text.dart';

enum NoteStatus { loading, clean, dirty, saving, saved, conflict, error }

/// A newer version exists on the server.
class RemoteNewer {
  const RemoteNewer(this.version, [this.updatedBy]);

  final int version;
  final MeetingPerson? updatedBy;

  @override
  bool operator ==(Object other) =>
      other is RemoteNewer &&
      other.version == version &&
      other.updatedBy == updatedBy;

  @override
  int get hashCode => Object.hash(version, updatedBy);

  @override
  String toString() => 'RemoteNewer($version, ${updatedBy?.displayName})';
}

const _keep = Object();

class NoteState {
  const NoteState({
    this.status = NoteStatus.loading,
    this.baseVersion = 0,
    this.baseContent = '',
    this.draft = '',
    this.savingDraft,
    this.latest,
    this.remoteNewer,
    this.error,
  });

  static const initial = NoteState();

  final NoteStatus status;

  /// Version the draft is based on (sent as `version`).
  final int baseVersion;
  final String baseContent;

  /// What the user sees — never overwritten while they have edits.
  final String draft;
  final String? savingDraft;

  /// The other version during a conflict.
  final MeetingNote? latest;
  final RemoteNewer? remoteNewer;
  final MeetingNotice? error;

  /// Nullable fields: omitted = unchanged, `null` = cleared.
  NoteState copyWith({
    NoteStatus? status,
    int? baseVersion,
    String? baseContent,
    String? draft,
    Object? savingDraft = _keep,
    Object? latest = _keep,
    Object? remoteNewer = _keep,
    Object? error = _keep,
  }) =>
      NoteState(
        status: status ?? this.status,
        baseVersion: baseVersion ?? this.baseVersion,
        baseContent: baseContent ?? this.baseContent,
        draft: draft ?? this.draft,
        savingDraft: identical(savingDraft, _keep)
            ? this.savingDraft
            : savingDraft as String?,
        latest: identical(latest, _keep) ? this.latest : latest as MeetingNote?,
        remoteNewer: identical(remoteNewer, _keep)
            ? this.remoteNewer
            : remoteNewer as RemoteNewer?,
        error: identical(error, _keep) ? this.error : error as MeetingNotice?,
      );
}

sealed class NoteAction {
  const NoteAction();
}

final class Loaded extends NoteAction {
  const Loaded(this.note);
  final MeetingNote note;
}

final class Edit extends NoteAction {
  const Edit(this.draft);
  final String draft;
}

final class SaveStarted extends NoteAction {
  const SaveStarted();
}

final class SaveSucceeded extends NoteAction {
  const SaveSucceeded(this.note);
  final MeetingNote note;
}

final class SaveConflicted extends NoteAction {
  const SaveConflicted(this.latest);
  final MeetingNote latest;
}

final class SaveFailed extends NoteAction {
  const SaveFailed(this.error);
  final MeetingNotice error;
}

final class RetrySave extends NoteAction {
  const RetrySave();
}

/// `meet.notes.updated`.
final class RemoteUpdated extends NoteAction {
  const RemoteUpdated(this.version, [this.updatedBy]);
  final int version;
  final MeetingPerson? updatedBy;
}

final class KeepMine extends NoteAction {
  const KeepMine();
}

final class TakeTheirs extends NoteAction {
  const TakeTheirs();
}

final class SaveMerged extends NoteAction {
  const SaveMerged(this.draft);
  final String draft;
}

/// Drop the "newer version exists" flag once our base caught up with it.
RemoteNewer? _settledRemote(RemoteNewer? remote, int version) =>
    remote != null && remote.version > version ? remote : null;

/// Rebase the draft on [note] (after a conflict was resolved).
NoteState _rebase(NoteState s, MeetingNote note, String draft) => s.copyWith(
      status: draft == note.content ? NoteStatus.clean : NoteStatus.dirty,
      baseVersion: note.version,
      baseContent: note.content,
      draft: draft,
      latest: null,
      remoteNewer: _settledRemote(s.remoteNewer, note.version),
      error: null,
    );

NoteState _onLoaded(NoteState s, MeetingNote note) {
  if (s.status != NoteStatus.loading && note.version <= s.baseVersion) {
    return s;
  }
  final replaceable = s.status == NoteStatus.loading ||
      s.status == NoteStatus.clean ||
      s.status == NoteStatus.saved ||
      (s.status == NoteStatus.error && s.draft == s.baseContent);
  if (replaceable) {
    return NoteState(
      status: NoteStatus.clean,
      baseVersion: note.version,
      baseContent: note.content,
      draft: note.content,
    );
  }
  return s.copyWith(remoteNewer: RemoteNewer(note.version, note.updatedBy));
}

NoteState _onEdit(NoteState s, String draft) {
  if (s.status == NoteStatus.loading) return s;
  if (s.status == NoteStatus.conflict || s.status == NoteStatus.saving) {
    return s.copyWith(draft: draft);
  }
  return s.copyWith(
    draft: draft,
    status: draft == s.baseContent ? NoteStatus.clean : NoteStatus.dirty,
    error: null,
  );
}

/// Returns the SAME instance when nothing changes.
NoteState noteReducer(NoteState s, NoteAction a) => switch (a) {
      Loaded(:final note) => _onLoaded(s, note),
      Edit(:final draft) => _onEdit(s, draft),
      SaveStarted() => s.copyWith(
          status: NoteStatus.saving, savingDraft: s.draft, error: null),
      SaveSucceeded(:final note) => s.copyWith(
          status:
              s.draft == note.content ? NoteStatus.saved : NoteStatus.dirty,
          baseVersion: note.version,
          baseContent: note.content,
          savingDraft: null,
          remoteNewer: _settledRemote(s.remoteNewer, note.version),
          error: null,
        ),
      SaveConflicted(:final latest) => s.copyWith(
          status: NoteStatus.conflict, latest: latest, savingDraft: null),
      SaveFailed(:final error) => s.copyWith(
          status: NoteStatus.error, error: error, savingDraft: null),
      RetrySave() => s.status == NoteStatus.error
          ? s.copyWith(status: NoteStatus.dirty, error: null)
          : s,
      RemoteUpdated(:final version, :final updatedBy) => _onRemote(
          s, version, updatedBy),
      KeepMine() => switch (s.latest) {
          final l? => _rebase(s, l, s.draft),
          null => s,
        },
      TakeTheirs() => switch (s.latest) {
          final l? => _rebase(s, l, l.content),
          null => s,
        },
      SaveMerged(:final draft) => switch (s.latest) {
          final l? => _rebase(s, l, draft),
          null => s,
        },
    };

NoteState _onRemote(NoteState s, int version, MeetingPerson? by) {
  if (version <= s.baseVersion) return s;
  final known = s.remoteNewer;
  if (known != null && known.version >= version) return s;
  return s.copyWith(remoteNewer: RemoteNewer(version, by));
}

bool canAutosave(NoteState s) => s.status == NoteStatus.dirty;

({String content, int version}) savePayload(NoteState s) =>
    (content: s.draft, version: s.baseVersion);

/// A newer version exists and nothing local would be lost by loading it.
bool needsRefetch(NoteState s) =>
    s.remoteNewer != null &&
    (s.status == NoteStatus.clean || s.status == NoteStatus.saved);

bool hasUnsavedText(NoteState s) =>
    s.draft != s.baseContent ||
    s.status == NoteStatus.saving ||
    s.status == NoteStatus.conflict;
