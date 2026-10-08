import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/display.dart';
import '../../domain/meeting_room_models.dart';
import 'meeting_room_scope.dart';
import 'room_controls.dart';

/// Group title inside the People sheet (12 / 500, muted), with an optional
/// action on the right.
class RoomSectionTitle extends StatelessWidget {
  const RoomSectionTitle(this.text, {super.key, this.action});

  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
        child: Row(children: [
          Expanded(
            child: Semantics(
              header: true,
              child: Text(text,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppTheme.mutedText(context))),
            ),
          ),
          if (action case final a?) a,
        ]),
      );
}

/// Who waits to be let in (host / co-host only): Admit / Deny each, Admit all
/// from two people — mirror of web `LobbySection`.
class LobbySection extends StatefulWidget {
  const LobbySection({super.key, required this.entries});

  final List<LobbyEntry> entries;

  @override
  State<LobbySection> createState() => _LobbySectionState();
}

class _LobbySectionState extends State<LobbySection> {
  final Set<String> _pending = {};

  /// One at a time: errors are reported by the controller.
  Future<void> _run(
      List<String> ids, Future<void> Function(String id) call) async {
    setState(() => _pending.addAll(ids));
    for (final id in ids) {
      await call(id);
    }
    if (mounted) setState(() => _pending.removeAll(ids));
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final entries = widget.entries;
    if (entries.isEmpty) return const SizedBox.shrink();
    final controller = MeetingRoomScope.of(context).controller;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      RoomSectionTitle(
        l.meetingSectionLobby(entries.length),
        action: entries.length >= 2
            ? TextButton(
                onPressed: _pending.isNotEmpty
                    ? null
                    : () => _run(
                        [for (final e in entries) e.userId], controller.admit),
                child: Text(l.meetingAdmitAll),
              )
            : null,
      ),
      for (final e in entries)
        _LobbyRow(
          name: safeDisplayName(e.displayName, e.userId) ??
              l.meetingParticipantFallback,
          busy: _pending.contains(e.userId),
          onAdmit: () => _run([e.userId], controller.admit),
          onDeny: () => _run([e.userId], controller.deny),
        ),
    ]);
  }
}

class _LobbyRow extends StatelessWidget {
  const _LobbyRow({
    required this.name,
    required this.busy,
    required this.onAdmit,
    required this.onDeny,
  });

  final String name;
  final bool busy;
  final VoidCallback onAdmit;
  final VoidCallback onDeny;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(children: [
        RoomAvatar(name: name),
        const SizedBox(width: 12),
        Expanded(
          child: Text(name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 14)),
        ),
        OutlinedButton(
            onPressed: busy ? null : onAdmit, child: Text(l.meetingAdmit)),
        const SizedBox(width: 4),
        TextButton(onPressed: busy ? null : onDeny, child: Text(l.meetingDeny)),
      ]),
    );
  }
}
