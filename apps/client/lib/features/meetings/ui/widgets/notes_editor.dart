import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/meeting_models.dart';
import '../../domain/note_sync.dart';
import 'note_tab.dart';

typedef NoteFlush = Future<void> Function();

/// Shared + private meeting notes: Markdown, autosave 2 s, conflicts never
/// lose text — mirror of web `NotesEditor`. A tab is fetched only once it has
/// been opened, then stays mounted (hidden) so "flush" saves both.
class NotesEditor extends StatefulWidget {
  const NotesEditor({
    super.key,
    required this.meetingId,
    required this.canEditShared,
    this.sharedRemote,
    this.onFlushReady,
  });

  final String meetingId;
  final bool canEditShared;

  /// `meet.notes.updated` while in the room; the detail screen passes nothing.
  final RemoteNewer? sharedRemote;

  /// In the room: receives "save both tabs now" (leaving / ending).
  final void Function(NoteFlush flush)? onFlushReady;

  @override
  State<NotesEditor> createState() => _NotesEditorState();
}

class _NotesEditorState extends State<NotesEditor> {
  NoteScope _tab = NoteScope.shared;
  final _opened = <NoteScope>{NoteScope.shared};
  final _flushes = <NoteScope, NoteFlush>{};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      widget.onFlushReady?.call(_flushAll);
    });
  }

  Future<void> _flushAll() async {
    await Future.wait([for (final f in _flushes.values.toList()) f()]);
  }

  void _register(NoteScope scope, NoteFlush? flush) {
    if (flush == null) {
      _flushes.remove(scope);
    } else {
      _flushes[scope] = flush;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentedButton<NoteScope>(
          segments: [
            ButtonSegment(
                value: NoteScope.shared, label: Text(l10n.meetingNotesShared)),
            ButtonSegment(
                value: NoteScope.private,
                label: Text(l10n.meetingNotesPrivate)),
          ],
          selected: {_tab},
          showSelectedIcon: false,
          onSelectionChanged: (s) => setState(() {
            _tab = s.first;
            _opened.add(s.first);
          }),
        ),
        const SizedBox(height: 12),
        for (final scope in NoteScope.values)
          if (_opened.contains(scope))
            Offstage(
              offstage: scope != _tab,
              child: TickerMode(
                enabled: scope == _tab,
                child: NoteTab(
                  key: ValueKey(scope),
                  meetingId: widget.meetingId,
                  scope: scope,
                  canEdit:
                      scope == NoteScope.private || widget.canEditShared,
                  remote:
                      scope == NoteScope.shared ? widget.sharedRemote : null,
                  registerFlush: _register,
                ),
              ),
            ),
      ],
    );
  }
}
