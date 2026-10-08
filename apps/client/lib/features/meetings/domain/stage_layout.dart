// Who is on the meeting stage, and where — mirror of web
// `lib/meetings/stage-layout.ts`. Pure: the stage widget feeds it the people
// in the room and renders the result.
//
// Priority for the big tile: a pin → someone else's screen share → my own
// share → (speaker mode) the active speaker → nothing (grid).

enum LayoutMode { grid, spotlight }

enum TileKind { camera, screen }

String cameraKey(String id) => '$id:camera';
String screenKey(String id) => '$id:screen';

/// Phone (width < 768 dp) vs wide grid capacity, including the "+N" tile.
const kPhoneMaxTiles = 6;
const kWideMaxTiles = 25;

class StageTile {
  const StageTile({
    required this.key,
    required this.identity,
    required this.kind,
    required this.isLocal,
  });

  final String key;
  final String identity;
  final TileKind kind;
  final bool isLocal;

  @override
  bool operator ==(Object other) =>
      other is StageTile &&
      other.key == key &&
      other.identity == identity &&
      other.kind == kind &&
      other.isLocal == isLocal;

  @override
  int get hashCode => Object.hash(key, identity, kind, isLocal);
}

const _keep = Object();

class StageInput {
  const StageInput({
    required this.mode,
    this.pinnedKey,
    required this.localIdentity,
    required this.remoteIds,
    required this.screenSharers,
    this.activeSpeakerId,
    required this.maxTiles,
  });

  final LayoutMode mode;
  final String? pinnedKey;
  final String localIdentity;
  final List<String> remoteIds;
  final List<String> screenSharers;
  final String? activeSpeakerId;
  final int maxTiles;

  /// [pinnedKey] / [activeSpeakerId] accept null to clear them.
  StageInput copyWith({
    LayoutMode? mode,
    Object? pinnedKey = _keep,
    List<String>? remoteIds,
    List<String>? screenSharers,
    Object? activeSpeakerId = _keep,
    int? maxTiles,
  }) =>
      StageInput(
        mode: mode ?? this.mode,
        pinnedKey:
            identical(pinnedKey, _keep) ? this.pinnedKey : pinnedKey as String?,
        localIdentity: localIdentity,
        remoteIds: remoteIds ?? this.remoteIds,
        screenSharers: screenSharers ?? this.screenSharers,
        activeSpeakerId: identical(activeSpeakerId, _keep)
            ? this.activeSpeakerId
            : activeSpeakerId as String?,
        maxTiles: maxTiles ?? this.maxTiles,
      );
}

class StageLayout {
  const StageLayout({
    this.main,
    this.strip = const [],
    this.grid = const [],
    this.overflow = 0,
    this.hiddenIds = const [],
  });

  final StageTile? main;
  final List<StageTile> strip;
  final List<StageTile> grid;

  /// People not shown in the grid (the "+N" tile).
  final int overflow;

  /// Remote identities without a tile — stop receiving their camera.
  final List<String> hiddenIds;
}

StageTile _tile(String id, TileKind kind, String local) => StageTile(
      key: kind == TileKind.camera ? cameraKey(id) : screenKey(id),
      identity: id,
      kind: kind,
      isLocal: id == local,
    );

StageTile? _pickMain(
    StageInput i, List<StageTile> cameras, List<StageTile> screens) {
  final all = [...screens, ...cameras];
  final pin = i.pinnedKey;
  if (pin != null) {
    for (final t in all) {
      if (t.key == pin) return t;
    }
  }
  for (final t in screens) {
    if (!t.isLocal) return t;
  }
  if (screens.isNotEmpty) return screens.first;
  if (i.mode != LayoutMode.spotlight) return null;
  final remotes = cameras.where((t) => !t.isLocal).toList();
  for (final t in remotes) {
    if (t.identity == i.activeSpeakerId) return t;
  }
  if (remotes.isNotEmpty) return remotes.first;
  return cameras.isEmpty ? null : cameras.first;
}

/// Grid with a capacity: me first, people in join order, the active speaker
/// kept visible.
StageLayout _fitGrid(StageInput i, List<StageTile> cameras) {
  final max = i.maxTiles < 1 ? 1 : i.maxTiles;
  if (cameras.length <= max) return StageLayout(grid: cameras);
  final me = cameras.first;
  final remotes = cameras.sublist(1);
  final slots = max - 2 < 0 ? 0 : max - 2; // minus me, minus the "+N" tile
  var visible = remotes.take(slots).toList();
  StageTile? speaker;
  for (final t in remotes) {
    if (t.identity == i.activeSpeakerId) {
      speaker = t;
      break;
    }
  }
  if (speaker != null && slots > 0 && !visible.contains(speaker)) {
    visible = [...visible.take(slots - 1), speaker];
  }
  final hidden = remotes.where((t) => !visible.contains(t)).toList();
  return StageLayout(
    grid: [me, ...visible],
    overflow: hidden.length,
    hiddenIds: hidden.map((t) => t.identity).toList(),
  );
}

/// Cameras in join order, then any other screen shares.
List<StageTile> _orderStrip(Iterable<StageTile> tiles) => [
      ...tiles.where((t) => t.kind == TileKind.camera),
      ...tiles.where((t) => t.kind == TileKind.screen),
    ];

StageLayout computeStage(StageInput i) {
  final people = [
    i.localIdentity,
    ...i.remoteIds.where((id) => id != i.localIdentity),
  ];
  final present = people.toSet();
  final cameras =
      people.map((id) => _tile(id, TileKind.camera, i.localIdentity)).toList();
  final seen = <String>{};
  final screens = i.screenSharers
      .where((id) => present.contains(id) && seen.add(id))
      .map((id) => _tile(id, TileKind.screen, i.localIdentity))
      .toList();

  final main = _pickMain(i, cameras, screens);
  if (main != null) {
    final strip = [...screens, ...cameras].where((t) => t.key != main.key);
    return StageLayout(main: main, strip: _orderStrip(strip));
  }
  return _fitGrid(i, cameras);
}

/// Columns for [count] grid tiles: phone 1–2, wide the smallest square that
/// fits.
int gridColumns(int count, {required bool mobile}) {
  if (count <= 1) return 1;
  if (mobile) return count <= 2 ? 1 : 2;
  var c = 1;
  while (c * c < count) {
    c++;
  }
  return c;
}
