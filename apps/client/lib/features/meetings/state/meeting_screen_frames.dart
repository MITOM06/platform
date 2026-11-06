// Shared-screen frames for the AI meeting record — mirror of web
// `lib/meetings/use-meeting-screen-frames.ts`. While active (in the room, AI
// notes on, MY screen share on, Android) every 5 s a frame of the screen is
// captured; when it changed enough and 15 s passed since the last one sent, it
// goes to the server as a small JPEG. Everything is silent: a failing
// `captureFrame` turns the feature off for this share, upload errors are
// dropped.

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart' as rtc;

import '../domain/frame_diff.dart';

/// One screenshot as PNG/JPEG bytes; null = nothing to capture right now;
/// throws = this device cannot capture (feature goes off for the share).
typedef ScreenFrameCapture = Future<Uint8List?> Function();
typedef ScreenFrameEncoder = Future<ProcessedFrame?> Function(
    Uint8List bytes, List<int>? lastThumb, int? lastSentAt, int now);
typedef ScreenFrameUploader = Future<void> Function(
    String meetingId, Uint8List jpeg, int ts);
typedef ScreenFrameTimer = Timer Function(Duration every, void Function() cb);

/// Frames are Android-only (P1 has no screen share on iOS).
bool screenFramesSupported() =>
    !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

Future<ProcessedFrame?> isolateEncoder(
        Uint8List bytes, List<int>? lastThumb, int? lastSentAt, int now) =>
    compute((_) => processScreenFrame(bytes, lastThumb, lastSentAt, now), null);

/// `captureFrame()` on the local screen-share video track.
Future<Uint8List?> captureScreenTrack(rtc.MediaStream? stream) async {
  final tracks = stream?.getVideoTracks();
  if (tracks == null || tracks.isEmpty) return null;
  final buf = await tracks.first.captureFrame();
  return buf.asUint8List();
}

class MeetingScreenFrames {
  MeetingScreenFrames({
    required this.capture,
    required this.upload,
    ScreenFrameEncoder? encoder,
    ScreenFrameTimer? timer,
    int Function()? now,
    bool Function()? isSupported,
    this.uploadTimeout = const Duration(seconds: 15),
  })  : _encoder = encoder ?? isolateEncoder,
        _timer = timer ?? ((d, cb) => Timer.periodic(d, (_) => cb())),
        _now = now ?? (() => DateTime.now().millisecondsSinceEpoch),
        _isSupported = isSupported ?? screenFramesSupported;

  final ScreenFrameCapture capture;
  final ScreenFrameUploader upload;
  final Duration uploadTimeout;
  final ScreenFrameEncoder _encoder;
  final ScreenFrameTimer _timer;
  final int Function() _now;
  final bool Function() _isSupported;

  /// True while frames are being read — drives the sharer's notice.
  final ValueNotifier<bool> reading = ValueNotifier(false);

  Timer? _ticker;
  String? _meetingId;
  int _gen = 0;
  bool _inFlight = false;
  bool _disabled = false; // captureFrame failed: off until the share ends
  List<int>? _lastThumb;
  int? _lastSentAt;

  /// [meetingId] null = not in the room. Safe to call on every change.
  void sync({required String? meetingId, required bool active}) {
    if (!active) _disabled = false; // a new share may try again
    final want = meetingId != null && active && !_disabled && _isSupported();
    if (!want) {
      _stop();
      return;
    }
    if (_ticker != null) {
      if (_meetingId == meetingId) return; // idempotent
      _stop(); // another meeting: never keep sending to the old one
    }
    _meetingId = meetingId;
    final gen = ++_gen;
    _lastThumb = null;
    _lastSentAt = null;
    reading.value = true;
    _ticker = _timer(const Duration(milliseconds: kScreenCheckMs),
        () => unawaited(_tick(meetingId, gen)));
    unawaited(_tick(meetingId, gen));
  }

  void dispose() {
    _stop();
    reading.dispose();
  }

  void _stop() {
    _ticker?.cancel();
    _ticker = null;
    _gen++;
    _inFlight = false;
    if (reading.value) reading.value = false;
  }

  Future<void> _tick(String meetingId, int gen) async {
    if (_inFlight || gen != _gen) return;
    _inFlight = true;
    try {
      Uint8List? bytes;
      try {
        bytes = await capture();
      } catch (e) {
        if (kDebugMode) debugPrint('screen frames: capture failed ($e)');
        if (gen == _gen) {
          _disabled = true;
          _stop();
        }
        return;
      }
      if (bytes == null || gen != _gen) return;
      final now = _now();
      final out = await _encoder(bytes, _lastThumb, _lastSentAt, now);
      if (out == null || gen != _gen) return;
      final jpeg = out.jpeg;
      if (jpeg == null) return;
      // Counted before the upload, so errors still wait out the gap.
      _lastThumb = out.thumb;
      _lastSentAt = now;
      await upload(meetingId, jpeg, now).timeout(uploadTimeout);
    } catch (e) {
      if (kDebugMode) debugPrint('screen frames: dropped ($e)');
    } finally {
      if (gen == _gen) _inFlight = false;
    }
  }
}
