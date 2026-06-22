import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';
import '../data/stomp_service.dart';

/// Client-side speech-to-text for the AI notetaker (contract §7).
///
/// Runs ONLY while `aiNotetaker` is on. On each FINAL recognition result it
/// publishes `/app/call.transcript {callId, text, ts}`. Interim results are
/// ignored. Gracefully no-ops if speech recognition is unavailable or denied.
class CallSttService {
  final StompService _stompService;
  final SpeechToText _speech = SpeechToText();

  String? _callId;
  bool _available = false;
  bool _running = false;

  CallSttService(this._stompService);

  bool get isRunning => _running;

  /// Initialize + begin listening. Returns true if STT actually started.
  Future<bool> start(String callId) async {
    _callId = callId;
    try {
      _available = await _speech.initialize(
        onError: (e) => debugPrint('STT error: ${e.errorMsg}'),
        onStatus: _onStatus,
      );
    } catch (e) {
      debugPrint('STT initialize failed: $e');
      _available = false;
    }
    if (!_available) return false;
    _running = true;
    await _listen();
    return true;
  }

  Future<void> _listen() async {
    if (!_running || !_available) return;
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
    if (!result.finalResult) return; // interim results ignored (§7)
    final text = result.recognizedWords.trim();
    if (text.isEmpty || _callId == null) return;
    _stompService.sendRawMessage(
      destination: '/app/call.transcript',
      body: jsonEncode({
        'callId': _callId,
        'text': text,
        'ts': DateTime.now().millisecondsSinceEpoch,
      }),
    );
  }

  void _onStatus(String status) {
    // The platform recognizer stops on silence/timeout — restart to keep a
    // continuous transcript while the notetaker is on.
    if (_running && (status == 'done' || status == 'notListening')) {
      _listen();
    }
  }

  Future<void> stop() async {
    _running = false;
    try {
      await _speech.stop();
    } catch (_) {}
    _callId = null;
  }
}
