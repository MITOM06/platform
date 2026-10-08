// Camera / mic preview of the meeting pre-join screen — mirror of web
// `lib/hooks/use-media-preview.ts` for phones: one getUserMedia stream for the
// chosen toggles and camera side, and why media is missing. Platform error
// text never leaves this file — only a kind.
//
// `release()` must run before the room captures the same devices (Android
// cannot open the camera twice).

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../domain/device_prefs.dart';

enum MediaPreviewError { blocked, unavailable }

abstract class MediaPreview extends ChangeNotifier {
  bool get mic;
  bool get camera;
  bool get frontCamera;

  /// The self-view; null while nothing is captured.
  MediaStream? get stream;
  MediaPreviewError? get error;

  void start(DevicePrefs prefs);
  void setMic(bool on);
  void setCamera(bool on);
  void flipCamera();

  /// Stops every preview track (no further capture until a toggle).
  void release();
}

/// Swapped for a fake in widget tests (no plugin).
final mediaPreviewFactoryProvider =
    Provider<MediaPreview Function()>((_) => WebRtcMediaPreview.new);

class _Capture {
  const _Capture(this.mic, this.camera, this.front);
  final bool mic;
  final bool camera;
  final bool front;

  _Capture copyWith({bool? mic, bool? camera, bool? front}) =>
      _Capture(mic ?? this.mic, camera ?? this.camera, front ?? this.front);
}

final _blocked =
    RegExp(r'NotAllowed|Permission|denied|SecurityError', caseSensitive: false);

MediaPreviewError _kind(Object e) => _blocked.hasMatch(e.toString())
    ? MediaPreviewError.blocked
    : MediaPreviewError.unavailable;

Future<void> _stop(MediaStream? s) async {
  if (s == null) return;
  try {
    for (final t in s.getTracks()) {
      await t.stop();
    }
    await s.dispose();
  } catch (_) {
    // already gone
  }
}

/// flutter_webrtc implementation.
class WebRtcMediaPreview extends MediaPreview {
  _Capture _c = const _Capture(true, true, true);
  MediaStream? _stream;
  MediaPreviewError? _error;
  int _seq = 0;
  bool _disposed = false;

  @override
  bool get mic => _c.mic;
  @override
  bool get camera => _c.camera;
  @override
  bool get frontCamera => _c.front;
  @override
  MediaStream? get stream => _stream;
  @override
  MediaPreviewError? get error => _error;

  @override
  void start(DevicePrefs prefs) {
    _c = _Capture(prefs.micOn, prefs.camOn, prefs.frontCamera);
    unawaited(_acquire());
  }

  @override
  void setMic(bool on) => _update(_c.copyWith(mic: on));

  @override
  void setCamera(bool on) => _update(_c.copyWith(camera: on));

  @override
  void flipCamera() => _update(_c.copyWith(front: !_c.front));

  void _update(_Capture next) {
    _c = next;
    _changed();
    unawaited(_acquire());
  }

  Future<MediaStream?> _open(_Capture c) async {
    if (!c.mic && !c.camera) return null;
    return navigator.mediaDevices.getUserMedia({
      'audio': c.mic,
      'video':
          c.camera ? {'facingMode': c.front ? 'user' : 'environment'} : false,
    });
  }

  /// Both, else whichever of mic / camera still works (the toggles follow).
  Future<void> _acquire() async {
    final id = ++_seq;
    final old = _stream;
    _stream = null;
    await _stop(old);
    final want = _c;
    MediaStream? next;
    MediaPreviewError? failed;
    var got = want;
    try {
      next = await _open(want);
    } catch (e) {
      failed = _kind(e);
      got = want.copyWith(mic: false, camera: false);
      final partials = want.mic && want.camera
          ? [want.copyWith(camera: false), want.copyWith(mic: false)]
          : const <_Capture>[];
      for (final p in partials) {
        try {
          next = await _open(p);
          got = p;
          break;
        } catch (_) {
          // try the other one
        }
      }
    }
    if (id != _seq || _disposed) {
      await _stop(next);
      return;
    }
    _stream = next;
    _error = failed;
    _c = got;
    _changed();
  }

  @override
  void release() {
    _seq++;
    final old = _stream;
    _stream = null;
    unawaited(_stop(old));
    _changed();
  }

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    release();
    _disposed = true;
    super.dispose();
  }
}
