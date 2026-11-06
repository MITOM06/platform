import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/frame_diff.dart';
import 'package:platform_client/features/meetings/state/meeting_screen_frames.dart';
import 'package:platform_client/features/meetings/state/meeting_room_state.dart';
import 'package:platform_client/features/meetings/domain/meeting_settings.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/state/room_session_wiring.dart';

class _Timer implements Timer {
  _Timer(this.cb);
  final void Function() cb;
  bool cancelled = false;
  @override
  void cancel() => cancelled = true;
  @override
  bool get isActive => !cancelled;
  @override
  int get tick => 0;
}

void main() {
  late List<_Timer> timers;
  late int clock;
  late int captures;
  late Object? captureError;
  late List<(String, int, int)> uploads;
  late List<ProcessedFrame?> encodeResults;
  late List<(List<int>?, int?, int)> encodeCalls;
  late Completer<void>? uploadGate;
  late Object? uploadError;
  late bool android;
  late MeetingScreenFrames f;

  setUp(() {
    timers = [];
    clock = 1000;
    captures = 0;
    captureError = null;
    uploads = [];
    encodeCalls = [];
    uploadGate = null;
    uploadError = null;
    android = true;
    encodeResults = [];
    f = MeetingScreenFrames(
      capture: () async {
        captures++;
        if (captureError != null) throw captureError!;
        return Uint8List.fromList([1]);
      },
      encoder: (b, thumb, lastAt, now) async {
        encodeCalls.add((thumb, lastAt, now));
        return encodeResults.isEmpty
            ? ProcessedFrame([9], Uint8List.fromList([0xFF, 0xD8]))
            : encodeResults.removeAt(0);
      },
      upload: (id, jpeg, ts) async {
        uploads.add((id, jpeg.length, ts));
        await uploadGate?.future;
        if (uploadError != null) throw uploadError!;
      },
      timer: (d, cb) {
        expect(d, const Duration(milliseconds: 5000));
        final t = _Timer(cb);
        timers.add(t);
        return t;
      },
      now: () => clock,
      isSupported: () => android,
    );
  });

  Future<void> flush() => Future<void>.delayed(Duration.zero);

  test('first frame is sent immediately on start', () async {
    f.sync(meetingId: 'm1', active: true);
    await flush();
    expect(uploads, [('m1', 2, 1000)]);
    expect(f.reading.value, true);
  });

  test('every 5 s tick passes last SENT thumb and time to the encoder',
      () async {
    f.sync(meetingId: 'm1', active: true);
    await flush();
    clock = 6000;
    timers.single.cb();
    await flush();
    expect(encodeCalls[0], (null, null, 1000));
    expect(encodeCalls[1].$1, [9]);
    expect((encodeCalls[1].$2, encodeCalls[1].$3), (1000, 6000));
  });

  test('encoder says no JPEG: nothing uploaded, last-sent not advanced',
      () async {
    encodeResults = [
      ProcessedFrame([9], Uint8List.fromList([1])),
      const ProcessedFrame([5], null),
      const ProcessedFrame([5], null),
    ];
    f.sync(meetingId: 'm1', active: true);
    await flush();
    clock = 6000;
    timers.single.cb();
    await flush();
    clock = 7000;
    timers.single.cb();
    await flush();
    expect(uploads.length, 1);
    expect(encodeCalls[2].$1, [9]);
    expect((encodeCalls[2].$2, encodeCalls[2].$3), (1000, 7000));
  });

  test('idempotent: same args do not restart', () async {
    f.sync(meetingId: 'm1', active: true);
    f.sync(meetingId: 'm1', active: true);
    await flush();
    expect(timers.length, 1);
    expect(captures, 1);
  });

  test('stops on inactive / null meeting; ticks after stop do nothing',
      () async {
    f.sync(meetingId: 'm1', active: true);
    await flush();
    f.sync(meetingId: 'm1', active: false);
    expect(timers.single.cancelled, true);
    expect(f.reading.value, false);
    timers.single.cb();
    await flush();
    expect(captures, 1);
    f.sync(meetingId: 'm1', active: true);
    f.sync(meetingId: null, active: true);
    expect(timers.last.cancelled, true);
  });

  test('one upload in flight: ticks meanwhile are skipped', () async {
    uploadGate = Completer<void>();
    f.sync(meetingId: 'm1', active: true);
    await flush();
    timers.single.cb();
    await flush();
    expect(captures, 1);
    uploadGate!.complete();
    await flush();
    timers.single.cb();
    await flush();
    expect(captures, 2);
  });

  test('upload errors are swallowed and the loop goes on', () async {
    uploadError = Exception('boom');
    f.sync(meetingId: 'm1', active: true);
    await flush();
    clock = 20000;
    timers.single.cb();
    await flush();
    expect(uploads.length, 2);
  });

  test('upload timing out is dropped', () async {
    f = MeetingScreenFrames(
      capture: () async => Uint8List.fromList([1]),
      encoder: (b, t, l, n) async =>
          ProcessedFrame([1], Uint8List.fromList([1])),
      upload: (id, j, ts) => Completer<void>().future,
      timer: (d, cb) => _Timer(cb),
      uploadTimeout: const Duration(milliseconds: 10),
      isSupported: () => true,
    );
    f.sync(meetingId: 'm1', active: true);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    // in-flight cleared: no exception escaped, next tick may run again
    f.dispose();
  });

  test('captureFrame throws: off for this share, silently', () async {
    captureError = StateError('no projection');
    f.sync(meetingId: 'm1', active: true);
    await flush();
    expect(timers.single.cancelled, true);
    expect(f.reading.value, false);
    f.sync(meetingId: 'm1', active: true); // still the same share
    await flush();
    expect(captures, 1);
    expect(timers.length, 1);
    // share ends, a new one starts: tries again
    f.sync(meetingId: 'm1', active: false);
    captureError = null;
    f.sync(meetingId: 'm1', active: true);
    await flush();
    expect(captures, 2);
    expect(uploads.length, 1);
  });

  test('capture returning null (no frame yet) just waits', () async {
    f = MeetingScreenFrames(
      capture: () async => null,
      encoder: (b, t, l, n) async => fail('not called'),
      upload: (id, j, ts) async => fail('not called'),
      timer: (d, cb) => _Timer(cb),
      isSupported: () => true,
    );
    f.sync(meetingId: 'm1', active: true);
    await flush();
    expect(f.reading.value, true);
  });

  test('not Android: never runs', () async {
    android = false;
    f.sync(meetingId: 'm1', active: true);
    await flush();
    expect(timers, isEmpty);
    expect(captures, 0);
    expect(f.reading.value, false);
  });

  test('screenFramesSyncArgs: in room + AI notes + my screen', () {
    final s = const MeetingRoomState().copyWith(
        phase: RoomPhase.inRoom,
        settings: const MeetingSettings(aiNotes: true),
        screen: true);
    expect(screenFramesSyncArgs(s, 'm1'), (meetingId: 'm1', active: true));
    expect(screenFramesSyncArgs(s.copyWith(screen: false), 'm1').active, false);
    expect(
        screenFramesSyncArgs(
                s.copyWith(settings: const MeetingSettings(aiNotes: false)),
                'm1')
            .active,
        false);
    expect(screenFramesSyncArgs(s.copyWith(phase: RoomPhase.left), 'm1'),
        (meetingId: null, active: false));
  });
}
