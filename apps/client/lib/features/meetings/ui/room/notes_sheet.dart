import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/meeting_models.dart';
import '../../domain/permissions.dart';
import '../../state/meeting_room_controller.dart';
import '../../state/meeting_room_providers.dart';
import '../../state/note_editor.dart';
import '../widgets/notes_editor.dart';
import 'meeting_room_scope.dart';

/// Meeting notes in the room — mirror of web `NotesPanel`. Edit rights follow
/// my CURRENT room role and the live `attendeesCanEditNotes`;
/// `meet.notes.updated` arrives via the room store. Closing the sheet saves
/// now; leaving / ending the meeting saves through the flush registered with
/// the controller.
class NotesSheet extends ConsumerStatefulWidget {
  const NotesSheet({super.key});

  @override
  ConsumerState<NotesSheet> createState() => _NotesSheetState();
}

class _NotesSheetState extends ConsumerState<NotesSheet> {
  late final MeetingRoomController _controller;
  NoteFlush? _flush;

  @override
  void initState() {
    super.initState();
    _controller = MeetingRoomScope.read(context).controller;
  }

  @override
  void dispose() {
    _controller.registerNotesFlush(null);
    super.dispose();
  }

  void _onFlushReady(NoteFlush flush) {
    _flush = flush;
    _controller.registerNotesFlush(flush);
  }

  void _flushNow() {
    final f = _flush;
    if (f != null) unawaited(f().catchError((Object _) {}));
  }

  @override
  Widget build(BuildContext context) {
    final meetingId = MeetingRoomScope.of(context).meeting.id;
    final canEdit = ref.watch(meetingRoomStoreProvider
        .select((s) => canEditSharedNoteRoom(s.myRole, s.settings)));
    final remote =
        ref.watch(meetingRoomStoreProvider.select((s) => s.sharedNoteRemote));
    // Back from a reconnect: reload the shared note when it is clean.
    ref.listen(meetingRoomStoreProvider.select((s) => s.sharedNoteResync),
        (_, __) {
      ref
          .read(noteEditorProvider(
              (meetingId: meetingId, scope: NoteScope.shared)).notifier)
          .resyncIfClean();
    });
    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) _flushNow();
      },
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
            16, 12, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
        child: NotesEditor(
          meetingId: meetingId,
          canEditShared: canEdit,
          sharedRemote: remote,
          onFlushReady: _onFlushReady,
        ),
      ),
    );
  }
}
