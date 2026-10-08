import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/display.dart';
import '../../domain/meeting_errors.dart';
import '../../domain/meeting_models.dart';
import '../../domain/note_sync.dart';
import '../../state/note_editor.dart';
import '../meeting_text_l10n.dart';
import 'note_conflict_sheet.dart';

/// One note (shared or private): write / preview, save status, newer-version
/// strip and the conflict block — web `NoteTab` inside `NotesEditor`.
class NoteTab extends ConsumerStatefulWidget {
  const NoteTab({
    super.key,
    required this.meetingId,
    required this.scope,
    required this.canEdit,
    required this.registerFlush,
    this.remote,
  });

  final String meetingId;
  final NoteScope scope;
  final bool canEdit;
  final RemoteNewer? remote;

  /// `null` flush = unregister.
  final void Function(NoteScope scope, Future<void> Function()? flush)
      registerFlush;

  @override
  ConsumerState<NoteTab> createState() => _NoteTabState();
}

class _NoteTabState extends ConsumerState<NoteTab> {
  final _controller = TextEditingController();
  bool _preview = false;

  NoteKey get _key => (meetingId: widget.meetingId, scope: widget.scope);
  NoteEditorNotifier get _editor => ref.read(noteEditorProvider(_key).notifier);

  @override
  void initState() {
    super.initState();
    final editor = _editor;
    editor.setCanEdit(widget.canEdit);
    final remote = widget.remote;
    if (remote != null) _remoteAfterBuild(remote);
    widget.registerFlush(widget.scope, () => editor.flush());
  }

  /// `meet.notes.updated` changes the editor's state: never while the tree
  /// builds (initState / didUpdateWidget) — right after the frame.
  void _remoteAfterBuild(RemoteNewer remote) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _editor.remoteUpdated(remote.version, remote.updatedBy);
    });
  }

  @override
  void didUpdateWidget(NoteTab old) {
    super.didUpdateWidget(old);
    if (old.canEdit != widget.canEdit) _editor.setCanEdit(widget.canEdit);
    final remote = widget.remote;
    if (remote != null && remote.version != old.remote?.version) {
      _remoteAfterBuild(remote);
    }
  }

  @override
  void dispose() {
    widget.registerFlush(widget.scope, null);
    _controller.dispose();
    super.dispose();
  }

  /// One-way sync: the text box follows the draft only when the draft changed
  /// without typing (load, take theirs) — typing already matches it.
  void _syncText(String draft) {
    if (_controller.text == draft) return;
    _controller.value = TextEditingValue(
        text: draft, selection: TextSelection.collapsed(offset: draft.length));
  }

  void _review(NoteState s) {
    final latest = s.latest;
    if (latest == null) return;
    final editor = _editor;
    NoteConflictSheet.show(context,
        latest: latest,
        draft: s.draft,
        onKeepMine: editor.keepMine,
        onTakeTheirs: editor.takeTheirs,
        onSaveMerged: editor.saveMerged);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<String>(noteEditorProvider(_key).select((v) => v.note.draft),
        (_, draft) => _syncText(draft));
    final l10n = context.l10n;
    final view = ref.watch(noteEditorProvider(_key));
    final s = view.note;
    final muted = TextStyle(fontSize: 12, color: AppTheme.mutedText(context));
    final label = widget.scope == NoteScope.shared
        ? l10n.meetingNotesShared
        : l10n.meetingNotesPrivate;
    final loadError = view.loadError;
    if (loadError != null) {
      return Text(meetingText(l10n, meetingErrorNotice(loadError)),
          style: muted);
    }
    final remote = s.remoteNewer;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          runSpacing: 4,
          children: [
            SegmentedButton<bool>(
              segments: [
                ButtonSegment(value: false, label: Text(l10n.meetingNotesWrite)),
                ButtonSegment(
                    value: true, label: Text(l10n.meetingNotesPreview)),
              ],
              selected: {_preview},
              showSelectedIcon: false,
              onSelectionChanged: (v) => setState(() => _preview = v.first),
            ),
            _SaveStatus(state: s, onRetry: _editor.retry),
          ],
        ),
        if (widget.scope == NoteScope.private)
          Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(l10n.meetingNotesPrivateHint, style: muted)),
        if (!widget.canEdit)
          Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(l10n.meetingNotesReadOnly, style: muted)),
        if (remote != null &&
            s.status != NoteStatus.conflict &&
            s.status != NoteStatus.clean &&
            s.status != NoteStatus.saved)
          _Strip(
              text: remote.updatedBy == null
                  ? l10n.meetingNotesRemoteNewerUnknown
                  : l10n.meetingNotesRemoteNewer(
                      personName(remote.updatedBy, l10n.meetingSomeone))),
        if (s.status == NoteStatus.conflict)
          _ConflictBlock(onReview: () => _review(s)),
        const SizedBox(height: 8),
        if (_preview)
          Container(
            constraints: const BoxConstraints(minHeight: 160),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: AppTheme.hairline(context)),
              borderRadius: BorderRadius.circular(AppTheme.radiusControl),
            ),
            child: MarkdownBody(data: s.draft, selectable: true),
          )
        else
          Semantics(
            label: label,
            child: TextField(
              controller: _controller,
              onChanged: _editor.edit,
              readOnly: !widget.canEdit,
              enabled: s.status != NoteStatus.loading,
              minLines: 8,
              maxLines: null,
              maxLength: MeetingLimits.note,
              keyboardType: TextInputType.multiline,
              decoration: InputDecoration(
                hintText: l10n.meetingNotesPlaceholder,
                counterText: '',
              ),
            ),
          ),
        if (s.draft.length > 45000)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
                l10n.meetingNotesCounter(s.draft.length, MeetingLimits.note),
                textAlign: TextAlign.end,
                style: muted),
          ),
      ],
    );
  }
}

class _SaveStatus extends StatelessWidget {
  const _SaveStatus({required this.state, required this.onRetry});

  final NoteState state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final error = state.error;
    final text = switch (state.status) {
      NoteStatus.saving => l10n.meetingNotesSaving,
      NoteStatus.saved => l10n.meetingNotesSaved,
      NoteStatus.dirty || NoteStatus.conflict => l10n.meetingNotesUnsaved,
      NoteStatus.error =>
        error == null ? l10n.meetingNotesSaveFailed : meetingText(l10n, error),
      NoteStatus.loading || NoteStatus.clean => '',
    };
    final failed = state.status == NoteStatus.error;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Flexible(
        child: Semantics(
          liveRegion: true,
          child: Text(text,
              style: TextStyle(
                  fontSize: 12,
                  color: failed
                      ? Theme.of(context).colorScheme.error
                      : AppTheme.mutedText(context))),
        ),
      ),
      if (failed)
        TextButton(onPressed: onRetry, child: Text(l10n.meetingNotesRetry)),
    ]);
  }
}

class _Strip extends StatelessWidget {
  const _Strip({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppTheme.mutedSurface(context),
          borderRadius: BorderRadius.circular(AppTheme.radiusControl),
        ),
        child: Text(text, style: const TextStyle(fontSize: 12)),
      );
}

class _ConflictBlock extends StatelessWidget {
  const _ConflictBlock({required this.onReview});

  final VoidCallback onReview;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final error = Theme.of(context).colorScheme.error;
    return Semantics(
      liveRegion: true,
      child: Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: error.withValues(alpha: 0.05),
          border: Border.all(color: error.withValues(alpha: 0.4)),
          borderRadius: BorderRadius.circular(AppTheme.radiusControl),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.meetingNotesConflictTitle,
                style:
                    const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
            const SizedBox(height: 4),
            Text(l10n.meetingNotesConflictDesc,
                style: TextStyle(
                    fontSize: 12, color: AppTheme.mutedText(context))),
            const SizedBox(height: 8),
            OutlinedButton(
                onPressed: onReview,
                child: Text(l10n.meetingNotesConflictReview)),
          ],
        ),
      ),
    );
  }
}
