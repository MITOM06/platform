import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../domain/display.dart';
import '../../domain/meeting_room_models.dart';

/// Compare the newer version with mine; keep mine, take theirs (asks once),
/// or save a hand-merged text — mirror of web `NoteConflictDialog`.
class NoteConflictSheet extends StatefulWidget {
  const NoteConflictSheet({
    super.key,
    required this.latest,
    required this.draft,
    required this.onKeepMine,
    required this.onTakeTheirs,
    required this.onSaveMerged,
  });

  /// The newer version someone else saved.
  final MeetingNote latest;

  /// The text being typed — editable here so it can be merged by hand.
  final String draft;
  final VoidCallback onKeepMine;
  final VoidCallback onTakeTheirs;
  final ValueChanged<String> onSaveMerged;

  static Future<void> show(
    BuildContext context, {
    required MeetingNote latest,
    required String draft,
    required VoidCallback onKeepMine,
    required VoidCallback onTakeTheirs,
    required ValueChanged<String> onSaveMerged,
  }) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => NoteConflictSheet(
          latest: latest,
          draft: draft,
          onKeepMine: onKeepMine,
          onTakeTheirs: onTakeTheirs,
          onSaveMerged: onSaveMerged,
        ),
      );

  @override
  State<NoteConflictSheet> createState() => _NoteConflictSheetState();
}

class _NoteConflictSheetState extends State<NoteConflictSheet> {
  late final _merged = TextEditingController(text: widget.draft);
  bool _showMine = true;
  bool _confirmDiscard = false;

  @override
  void dispose() {
    _merged.dispose();
    super.dispose();
  }

  void _close() => Navigator.of(context).pop();

  void _takeTheirs() {
    if (!_confirmDiscard) {
      setState(() => _confirmDiscard = true);
      return;
    }
    widget.onTakeTheirs();
    _close();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final media = MediaQuery.of(context);
    final muted = AppTheme.mutedText(context);
    final error = Theme.of(context).colorScheme.error;
    final author = widget.latest.updatedBy == null
        ? null
        : personName(widget.latest.updatedBy, l10n.meetingSomeone);
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: media.size.height * 0.92),
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + media.viewInsets.bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.meetingNotesConflictTitle,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(l10n.meetingNotesConflictDesc,
                style: TextStyle(fontSize: 14, color: muted)),
            const SizedBox(height: 16),
            SegmentedButton<bool>(
              segments: [
                ButtonSegment(
                    value: false, label: Text(l10n.meetingNotesConflictTheirs)),
                ButtonSegment(
                    value: true, label: Text(l10n.meetingNotesConflictMine)),
              ],
              selected: {_showMine},
              showSelectedIcon: false,
              onSelectionChanged: (s) => setState(() => _showMine = s.first),
            ),
            const SizedBox(height: 12),
            if (_showMine)
              TextField(
                controller: _merged,
                minLines: 6,
                maxLines: 12,
                keyboardType: TextInputType.multiline,
                decoration:
                    InputDecoration(labelText: l10n.meetingNotesConflictMine),
              )
            else
              _TheirsBox(text: widget.latest.content, author: author),
            if (_confirmDiscard) ...[
              const SizedBox(height: 12),
              Semantics(
                liveRegion: true,
                child: Text(l10n.meetingNotesConflictDiscardWarning,
                    style: TextStyle(fontSize: 12, color: error)),
              ),
            ],
            const SizedBox(height: 16),
            PonButton(
              onPressed: () {
                widget.onKeepMine();
                _close();
              },
              child: Text(l10n.meetingNotesConflictKeepMine),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44)),
              onPressed: () {
                widget.onSaveMerged(_merged.text);
                _close();
              },
              child: Text(l10n.meetingNotesConflictSaveMerged),
            ),
            const SizedBox(height: 8),
            TextButton(
              style: TextButton.styleFrom(
                  foregroundColor: error,
                  minimumSize: const Size.fromHeight(44)),
              onPressed: _takeTheirs,
              child: Text(l10n.meetingNotesConflictTakeTheirs),
            ),
          ],
        ),
      ),
    );
  }
}

class _TheirsBox extends StatelessWidget {
  const _TheirsBox({required this.text, this.author});

  final String text;
  final String? author;

  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minHeight: 144, maxHeight: 288),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.mutedSurface(context),
          borderRadius: BorderRadius.circular(AppTheme.radiusControl),
          border: Border.all(color: AppTheme.hairline(context)),
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (author != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(author ?? '',
                      style: TextStyle(
                          fontSize: 12, color: AppTheme.mutedText(context))),
                ),
              SelectableText(text, style: const TextStyle(fontSize: 14)),
            ],
          ),
        ),
      );
}
