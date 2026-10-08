import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/stage_layout.dart';

const base = StageInput(
    mode: LayoutMode.grid,
    pinnedKey: null,
    localIdentity: 'me',
    remoteIds: ['a', 'b'],
    screenSharers: [],
    activeSpeakerId: null,
    maxTiles: 25);
List<String> keys(List<StageTile> t) => t.map((x) => x.key).toList();

void main() {
  test('grid: me first, then people in join order', () {
    final s = computeStage(base);
    expect(s.main, isNull);
    expect(keys(s.grid), ['me:camera', 'a:camera', 'b:camera']);
    expect(s.overflow, 0);
    expect(s.hiddenIds, isEmpty);
    expect(s.strip, isEmpty);
  });

  test('a pinned tile takes the stage; a pin on someone who left is ignored', () {
    final s = computeStage(base.copyWith(pinnedKey: 'b:camera'));
    expect(s.main?.key, 'b:camera');
    expect(keys(s.strip), ['me:camera', 'a:camera']);
    expect(s.grid, isEmpty);
    expect(computeStage(base.copyWith(pinnedKey: 'gone:camera')).main, isNull);
  });

  test('a remote screen share always takes the stage, cameras go to the strip', () {
    final s = computeStage(base.copyWith(screenSharers: ['a']));
    expect((s.main?.key, s.main?.kind, s.main?.isLocal), ('a:screen', TileKind.screen, false));
    expect(keys(s.strip), ['me:camera', 'a:camera', 'b:camera']);
  });

  test('a pin beats a share; my own share is staged only when nobody else shares', () {
    expect(computeStage(base.copyWith(screenSharers: ['a'], pinnedKey: 'b:camera')).main?.key,
        'b:camera');
    expect(computeStage(base.copyWith(screenSharers: ['me'])).main?.isLocal, isTrue);
    final both = computeStage(base.copyWith(screenSharers: ['me', 'b']));
    expect(both.main?.key, 'b:screen');
    expect(keys(both.strip), contains('me:screen'));
  });

  test('spotlight follows the active speaker, then the first person, then me', () {
    final sp = base.copyWith(mode: LayoutMode.spotlight);
    expect(computeStage(sp.copyWith(activeSpeakerId: 'b')).main?.key, 'b:camera');
    expect(computeStage(sp).main?.key, 'a:camera');
    expect(computeStage(sp.copyWith(remoteIds: [])).main?.key, 'me:camera');
    expect(computeStage(sp.copyWith(activeSpeakerId: 'me')).main?.key, 'a:camera');
  });

  test('overflows past capacity and keeps the active speaker visible', () {
    final many = base.copyWith(remoteIds: ['a', 'b', 'c', 'd', 'e'], maxTiles: 4);
    final s = computeStage(many);
    expect(keys(s.grid), ['me:camera', 'a:camera', 'b:camera']);
    expect(s.overflow, 3);
    expect(s.hiddenIds, ['c', 'd', 'e']);
    final talking = computeStage(many.copyWith(activeSpeakerId: 'e'));
    expect(keys(talking.grid), ['me:camera', 'a:camera', 'e:camera']);
    expect(talking.hiddenIds, ['b', 'c', 'd']);
  });

  test('grid columns', () {
    expect([1, 2, 3, 6].map((n) => gridColumns(n, mobile: true)), [1, 1, 2, 2]);
    expect([1, 2, 4, 5, 9, 10, 16, 17, 25].map((n) => gridColumns(n, mobile: false)),
        [1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
}
