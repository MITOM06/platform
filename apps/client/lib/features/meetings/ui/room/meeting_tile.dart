import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/display.dart';
import '../../domain/meeting_models.dart';
import '../../domain/meeting_room_models.dart';
import '../../domain/permissions.dart';
import '../../domain/stage_layout.dart';
import '../../state/meeting_room_providers.dart';
import '../../state/meeting_room_state.dart';
import 'meeting_room_scope.dart';
import 'room_controls.dart';
import 'room_sheet.dart';
import 'stream_video.dart';
import 'tile_badges.dart';

enum TileVariant { main, grid, strip }

/// What one tile shows — compared by value so unrelated room changes do not
/// repaint it.
typedef _TileData = ({
  MeetingPeer? peer,
  MediaStream? stream,
  bool video,
  bool micMuted,
  bool mirror,
  bool pinned,
  MeetingRoomRole? role,
  String? rosterName,
  int hand,
});

_TileData _dataOf(MeetingRoomState s, StageTile tile) {
  final screen = tile.kind == TileKind.screen;
  MeetingPeer? peer;
  if (!tile.isLocal) {
    for (final p in s.peers) {
      if (p.identity == tile.identity) peer = p;
    }
  }
  RosterEntry? entry;
  for (final r in s.roster) {
    if (r.userId == tile.identity) entry = r;
  }
  final stream = screen
      ? (tile.isLocal ? s.localScreen : peer?.screen)
      : (tile.isLocal ? s.localStream : peer?.stream);
  return (
    peer: peer,
    stream: stream,
    video: screen || (tile.isLocal ? s.camera : !(peer?.camMuted ?? true)),
    micMuted: tile.isLocal ? !s.mic : (peer?.micMuted ?? false),
    mirror: tile.isLocal && !screen && s.frontCamera,
    pinned: s.pinnedKey == tile.key,
    role: entry?.role,
    rosterName: entry?.displayName,
    hand: s.hands.indexWhere((h) => h.userId == tile.identity),
  );
}

/// One stage tile: a camera or a screen share, mine or someone else's —
/// mirror of web `MeetingTile`. Long-press opens Pin / Unpin.
class MeetingTile extends ConsumerWidget {
  const MeetingTile({super.key, required this.tile, required this.variant});

  final StageTile tile;
  final TileVariant variant;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final scope = MeetingRoomScope.of(context);
    final d =
        ref.watch(meetingRoomStoreProvider.select((s) => _dataOf(s, tile)));
    final screen = tile.kind == TileKind.screen;
    if (screen && tile.isLocal && variant == TileVariant.main) {
      return _Presenting(onStop: scope.controller.toggleScreenShare);
    }
    final peer = d.peer;
    final role = d.role;
    final name = tile.isLocal
        ? (scope.myName.isEmpty ? l.meetingYou : scope.myName)
        : safeDisplayName(peer?.name, tile.identity) ??
            safeDisplayName(d.rosterName, tile.identity) ??
            l.meetingParticipantFallback;
    final label = screen
        ? (tile.isLocal ? l.meetingPresenting : l.meetingPresentingName(name))
        : (tile.isLocal && scope.myName.isNotEmpty
            ? l.meetingNameWithYou(scope.myName)
            : name);
    final stream = d.stream;
    final speaking = !screen && (peer?.speaking ?? false);
    final cs = Theme.of(context).colorScheme;
    return RepaintBoundary(
      child: Semantics(
        onLongPressHint: l.meetingTileMenu(label),
        child: GestureDetector(
          onLongPress: () => unawaited(_menu(context, d.pinned)),
          child: Container(
            foregroundDecoration: speaking
                ? BoxDecoration(
                    border: Border.all(color: cs.primary, width: 2),
                    borderRadius: BorderRadius.circular(8))
                : null,
            decoration: BoxDecoration(
                color: kStageTile, borderRadius: BorderRadius.circular(8)),
            clipBehavior: Clip.antiAlias,
            child: Stack(fit: StackFit.expand, children: [
              if (d.video && stream != null)
                StreamVideo(stream: stream, mirror: d.mirror, contain: screen)
              else
                Center(
                  child: RoomAvatar(
                      name: name,
                      avatarUrl:
                          tile.isLocal ? scope.myAvatarUrl : peer?.avatarUrl,
                      size: variant == TileVariant.strip ? 40 : 64),
                ),
              Positioned(left: 6, bottom: 6, right: 6, child: TileLabel(label)),
              if (!screen)
                Positioned(
                  top: 6,
                  right: 6,
                  child: TileBadges(
                    poor: peer?.poorConnection ?? false,
                    manager: role != null && isManagerRoom(role),
                    hand: d.hand,
                    micMuted: d.micMuted,
                  ),
                ),
            ]),
          ),
        ),
      ),
    );
  }

  Future<void> _menu(BuildContext context, bool pinned) {
    final l = context.l10n;
    final controller = MeetingRoomScope.read(context).controller;
    return showRoomSheet<void>(
      context,
      tall: false,
      builder: (sheet) => ListTile(
        leading:
            Icon(pinned ? Icons.push_pin_outlined : Icons.push_pin_rounded),
        title: Text(pinned ? l.meetingUnpin : l.meetingPin),
        onTap: () {
          controller.togglePin(tile.key);
          Navigator.of(sheet).pop();
        },
      ),
    );
  }
}

class _Presenting extends StatelessWidget {
  const _Presenting({required this.onStop});

  final Future<void> Function() onStop;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Container(
      decoration: BoxDecoration(
          color: kStageTile, borderRadius: BorderRadius.circular(8)),
      padding: const EdgeInsets.all(16),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(Icons.screen_share_rounded,
            size: 32, color: Colors.white.withValues(alpha: 0.7)),
        const SizedBox(height: 12),
        Text(l.meetingPresenting,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 14)),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: () => unawaited(onStop()),
          child: Text(l.meetingStopPresenting),
        ),
      ]),
    );
  }
}
