import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';
import '../data/stomp_service.dart';

/// On-device speech recognition that keeps listening: calls `onFinal` with
/// each FINAL result (interim ones are ignored) and restarts when the
/// platform stops on silence/timeout. Shared by group calls and meetings.
///
/// A denied permission / unavailable recognizer never loops: [start] returns
/// false (or `onBlocked` fires mid-run) and the capture stays stopped.
class SpeechCapture {
  SpeechCapture([SpeechToText? speech]) : _speech = speech ?? SpeechToText();

  final SpeechToText _speech;
  void Function(String text)? _onFinal;
  void Function()? _onBlocked;
  bool _running = false;

  /// Bumped by every start/stop: a stale `initialize` is dropped.
  int _token = 0;

  bool get running => _running;

  /// Initialize + begin listening. Returns true if recognition started.
  Future<bool> start(void Function(String text) onFinal,
      {void Function()? onBlocked}) async {
    final token = ++_token;
    _onFinal = onFinal;
    _onBlocked = onBlocked;
    var available = false;
    try {
      available = await _speech.initialize(
        onError: _onError,
        onStatus: _onStatus,
      );
    } catch (e) {
      debugPrint('STT initialize failed: $e');
    }
    if (token != _token) return false; // stopped / restarted meanwhile
    if (!available) return false;
    // SpeechToText is a process-wide singleton and initialize() only binds
    // the listeners on its FIRST success: rebind so the latest capture (group
    // call vs meeting) gets the 'done' restarts and errors.
    _speech.statusListener = _onStatus;
    _speech.errorListener = _onError;
    _running = true;
    await _listen();
    return true;
  }

  Future<void> _listen() async {
    if (!_running) return;
    try {
      await _speech.listen(
        onResult: _onResult,
        // Long windows keep the recognizer alive through a conversation;
        // _onStatus restarts it when the platform stops on silence.
        listenOptions: SpeechListenOptions(
          partialResults: false,
          cancelOnError: false,
          listenFor: const Duration(minutes: 5),
          pauseFor: const Duration(seconds: 6),
        ),
      );
    } catch (e) {
      debugPrint('STT listen failed: $e');
    }
  }

  void _onResult(SpeechRecognitionResult result) {
    // A stopped recognizer can still flush a late result: drop it.
    if (!_running || !result.finalResult) return;
    final text = result.recognizedWords.trim();
    if (text.isNotEmpty) _onFinal?.call(text);
  }

  void _onError(dynamic e) {
    final msg = '${e.errorMsg}'.toLowerCase();
    debugPrint('STT error: $msg');
    // Permission denied / recognizer disabled: restarting would loop.
    if (_running && msg.contains('permission')) {
      final blocked = _onBlocked;
      unawaited(stop());
      blocked?.call();
    }
  }

  void _onStatus(String status) {
    // The platform recognizer stops on silence/timeout — restart to keep a
    // continuous transcript.
    if (_running && (status == 'done' || status == 'notListening')) {
      _listen();
    }
  }

  Future<void> stop() async {
    _token++;
    _running = false;
    try {
      await _speech.stop();
    } catch (_) {}
  }
}

/// Client-side speech-to-text for the AI notetaker (contract §7).
///
/// Runs ONLY while `aiNotetaker` is on. On each FINAL recognition result it
/// publishes `/app/call.transcript {callId, text, ts}`. Interim results are
/// ignored. Gracefully no-ops if speech recognition is unavailable or denied.
class CallSttService {
  CallSttService(this._stompService, [SpeechToText? speech])
      : _capture = SpeechCapture(speech);

  final StompService _stompService;
  final SpeechCapture _capture;
  String? _callId;

  bool get isRunning => _capture.running;

  /// Initialize + begin listening. Returns true if STT actually started.
  Future<bool> start(String callId) {
    _callId = callId;
    return _capture.start(_publish);
  }

  void _publish(String text) {
    final id = _callId;
    if (id == null) return;
    _stompService.sendRawMessage(
      destination: '/app/call.transcript',
      body: jsonEncode({
        'callId': id,
        'text': text,
        'ts': DateTime.now().millisecondsSinceEpoch,
      }),
    );
  }

  Future<void> stop() async {
    await _capture.stop();
    _callId = null;
  }
}
