import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';
import 'room_controls.dart';

/// Name pill at the bottom-left of a tile (white on a dark pill over video).
class TileLabel extends StatelessWidget {
  const TileLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.bottomLeft,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
              color: kStagePill, borderRadius: BorderRadius.circular(6)),
          child: Text(text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 12)),
        ),
      );
}

/// Top-right state of a camera tile: unstable connection, host / co-host,
/// raised hand (+ its place in line), mic off.
class TileBadges extends StatelessWidget {
  const TileBadges({
    super.key,
    required this.poor,
    required this.manager,
    required this.hand,
    required this.micMuted,
  });

  final bool poor;
  final bool manager;

  /// Index in the raised-hands line, -1 when the hand is down.
  final int hand;
  final bool micMuted;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      if (poor)
        _Badge(
            label: l.meetingPoorConnectionPeer,
            icon: Icons.signal_cellular_alt_1_bar_rounded),
      if (manager)
        _Badge(label: l.meetingHostBadge, icon: Icons.shield_rounded),
      if (hand >= 0)
        _Badge(
            label: l.meetingHandRaisedLabel,
            icon: Icons.back_hand_rounded,
            count: hand + 1),
      if (micMuted)
        _Badge(label: l.meetingMicMutedLabel, icon: Icons.mic_off_rounded),
    ]);
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.icon, this.count});

  final String label;
  final IconData icon;
  final int? count;

  @override
  Widget build(BuildContext context) {
    final n = count;
    return Semantics(
      label: n == null ? label : '$label $n',
      excludeSemantics: true,
      child: Container(
        margin: const EdgeInsets.only(left: 4),
        height: 24,
        constraints: const BoxConstraints(minWidth: 24),
        padding: const EdgeInsets.symmetric(horizontal: 6),
        decoration: BoxDecoration(
            color: kStagePill, borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: Colors.white),
          if (n != null) ...[
            const SizedBox(width: 2),
            Text('$n',
                style: const TextStyle(color: Colors.white, fontSize: 12)),
          ],
        ]),
      ),
    );
  }
}
