import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/stage_layout.dart';
import '../../state/meeting_room_providers.dart';
import '../../state/meeting_room_state.dart';
import 'meeting_room_scope.dart';
import 'meeting_tile.dart';
import 'room_controls.dart';
import 'room_panels.dart';

const _gap = 8.0;
const _stripHeight = 112.0;

/// What the stage depends on — compared field by field, so a reaction or a
/// chat line never rebuilds the stage.
typedef _StageKey = ({
  List<String> remoteIds,
  List<String> sharers,
  bool screen,
  LayoutMode layout,
  String? pinnedKey,
  String? speaker,
});

bool _sameKey(_StageKey a, _StageKey b) =>
    a.screen == b.screen &&
    a.layout == b.layout &&
    a.pinnedKey == b.pinnedKey &&
    a.speaker == b.speaker &&
    _sameList(a.remoteIds, b.remoteIds) &&
    _sameList(a.sharers, b.sharers);

bool _sameList(List<String> a, List<String> b) {
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

_StageKey _keyOf(MeetingRoomState s) => (
      remoteIds: [for (final p in s.peers) p.identity],
      sharers: [
        for (final p in s.peers)
          if (p.screen != null) p.identity
      ],
      screen: s.screen,
      layout: s.layout,
      pinnedKey: s.pinnedKey,
      speaker: s.activeSpeakerId,
    );

/// The stage: a big tile + strip (pin / share / speaker mode), or the grid —
/// mirror of web `MeetingStage`. Hidden people stop sending their camera here.
class MeetingStage extends ConsumerStatefulWidget {
  const MeetingStage({super.key});

  @override
  ConsumerState<MeetingStage> createState() => _MeetingStageState();
}

class _MeetingStageState extends ConsumerState<MeetingStage> {
  _StageKey? _last;
  Set<String> _disabled = {};

  /// Stop receiving the camera of people without a tile; resume when they
  /// get one back (after the frame — never while building).
  void _syncHidden(List<String> hiddenIds) {
    final hidden = hiddenIds.toSet();
    if (hidden.length == _disabled.length && hidden.containsAll(_disabled)) {
      return;
    }
    final controller = MeetingRoomScope.read(context).controller;
    final before = _disabled;
    _disabled = hidden;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      for (final id in hidden.difference(before)) {
        controller.setPeerVideoEnabled(id, false);
      }
      for (final id in before.difference(hidden)) {
        controller.setPeerVideoEnabled(id, true);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final key = ref.watch(meetingRoomStoreProvider.select((s) {
      final next = _keyOf(s);
      final prev = _last;
      return prev != null && _sameKey(prev, next) ? prev : _last = next;
    }));
    final myId = MeetingRoomScope.of(context).myId;
    final mobile = MediaQuery.sizeOf(context).width < 768;
    final stage = computeStage(StageInput(
      mode: key.layout,
      pinnedKey: key.pinnedKey,
      localIdentity: myId,
      remoteIds: key.remoteIds,
      screenSharers: [if (key.screen) myId, ...key.sharers],
      activeSpeakerId: key.speaker,
      maxTiles: mobile ? kPhoneMaxTiles : kWideMaxTiles,
    ));
    _syncHidden(stage.hiddenIds);
    final main = stage.main;
    if (main != null) {
      return Padding(
        padding: const EdgeInsets.all(_gap),
        child: Column(children: [
          Expanded(child: MeetingTile(tile: main, variant: TileVariant.main)),
          if (stage.strip.isNotEmpty) ...[
            const SizedBox(height: _gap),
            SizedBox(height: _stripHeight, child: _Strip(stage.strip)),
          ],
        ]),
      );
    }
    return _Grid(stage: stage, mobile: mobile);
  }
}

class _Strip extends StatelessWidget {
  const _Strip(this.tiles);

  final List<StageTile> tiles;

  @override
  Widget build(BuildContext context) => ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: tiles.length,
        separatorBuilder: (_, __) => const SizedBox(width: _gap),
        itemBuilder: (_, i) => AspectRatio(
          aspectRatio: 16 / 9,
          child: MeetingTile(
              key: ValueKey(tiles[i].key),
              tile: tiles[i],
              variant: TileVariant.strip),
        ),
      );
}

class _Grid extends StatelessWidget {
  const _Grid({required this.stage, required this.mobile});

  final StageLayout stage;
  final bool mobile;

  @override
  Widget build(BuildContext context) {
    final cells = <Widget>[
      for (final t in stage.grid)
        MeetingTile(key: ValueKey(t.key), tile: t, variant: TileVariant.grid),
      if (stage.overflow > 0) _OverflowTile(count: stage.overflow),
    ];
    final cols = gridColumns(cells.length, mobile: mobile);
    final rows = <Widget>[];
    for (var i = 0; i < cells.length; i += cols) {
      final row = cells.sublist(i, (i + cols).clamp(0, cells.length));
      rows.add(Expanded(
        child: Row(children: [
          for (var j = 0; j < cols; j++) ...[
            if (j > 0) const SizedBox(width: _gap),
            Expanded(child: j < row.length ? row[j] : const SizedBox()),
          ],
        ]),
      ));
    }
    return Padding(
      padding: const EdgeInsets.all(_gap),
      child: Column(children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const SizedBox(height: _gap),
          rows[i],
        ],
      ]),
    );
  }
}

/// "+N": everyone without a tile is listed in the People panel.
class _OverflowTile extends StatelessWidget {
  const _OverflowTile({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Semantics(
      button: true,
      label: l.meetingOverflowMore(count),
      excludeSemantics: true,
      child: Material(
        color: kStageTile,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => openRoomPanel(context, RoomPanel.people),
          child: Center(
            child: Text(l.meetingOverflowTiles(count),
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w600)),
          ),
        ),
      ),
    );
  }
}
