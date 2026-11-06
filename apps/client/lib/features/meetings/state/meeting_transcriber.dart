// Speech capture for AI meeting notes — mirror of web
// `lib/meetings/use-meeting-transcriber.ts`. While active (in the room, AI
// notes on, my mic on) and not paused, each final line goes to
// `/app/meet.transcript {meetingId, text, ts}`. Pausing only stops
// recognition — the call's mic track is untouched.

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../chat/data/stomp_service.dart';
import '../../chat/domain/call_stt_service.dart';

class MeetingTranscriber {
  MeetingTranscriber(this._stomp, this._capture);

  final StompService _stomp;
  final SpeechCapture _capture;

  /// My own switch ("pause my speech"); reset when I leave the room.
  final ValueNotifier<bool> paused = ValueNotifier(false);

  /// null = not tried yet; false = permission denied / no recognizer.
  final ValueNotifier<bool?> supported = ValueNotifier(null);

  String? _meetingId;
  bool _active = false;
  bool _running = false;

  /// Bumped on every stop: a start still pending when it changed is dropped.
  int _gen = 0;

  /// [meetingId] null = not in the room. Safe to call on every change.
  void sync({required String? meetingId, required bool active}) {
    _meetingId = meetingId;
    _active = active;
    if (meetingId == null) {
      paused.value = false;
      _stop();
      supported.value = null;
      return;
    }
    _apply();
  }

  void setPaused(bool value) {
    paused.value = value;
    _apply();
  }

  void dispose() {
    _stop();
    paused.dispose();
    supported.dispose();
  }

  void _apply() {
    final want = _meetingId != null &&
        _active &&
        !paused.value &&
        supported.value != false;
    if (want && !_running) {
      unawaited(_start());
    } else if (!want && _running) {
      _stop();
    }
  }

  Future<void> _start() async {
    _running = true;
    final gen = ++_gen;
    var ok = false;
    try {
      ok = await _capture.start(_publish, onBlocked: () => _block(gen));
    } catch (_) {}
    if (gen != _gen) return; // stopped meanwhile (it already stopped capture)
    if (ok) {
      supported.value = true;
    } else {
      _running = false;
      supported.value = false;
    }
  }

  void _block(int gen) {
    if (gen != _gen) return;
    _running = false;
    supported.value = false;
  }

  void _stop() {
    if (!_running) return;
    _running = false;
    _gen++;
    unawaited(_capture.stop());
  }

  void _publish(String text) {
    final id = _meetingId;
    if (!_running || id == null || text.trim().isEmpty) return;
    _stomp.sendRawMessage(
      destination: '/app/meet.transcript',
      body: jsonEncode({
        'meetingId': id,
        'text': text,
        'ts': DateTime.now().millisecondsSinceEpoch,
      }),
    );
  }
}
