import 'package:flutter_test/flutter_test.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:platform_client/features/chat/domain/call_stt_service.dart';

/// Mimics the real singleton: only the FIRST initialize() binds the
/// listeners (speech_to_text.dart returns early once initialised).
class _SingletonSpeech implements SpeechToText {
  @override
  SpeechErrorListener? errorListener;
  @override
  SpeechStatusListener? statusListener;
  bool _inited = false;
  int listens = 0;

  @override
  Future<bool> initialize({
    SpeechErrorListener? onError,
    SpeechStatusListener? onStatus,
    debugLogging = false,
    Duration finalTimeout = const Duration(milliseconds: 2000),
    List<SpeechConfigOption>? options,
  }) async {
    if (_inited) return true;
    _inited = true;
    errorListener = onError;
    statusListener = onStatus;
    return true;
  }

  @override
  Future listen({
    SpeechResultListener? onResult,
    Duration? listenFor,
    Duration? pauseFor,
    String? localeId,
    SpeechSoundLevelChange? onSoundLevelChange,
    cancelOnError = false,
    partialResults = true,
    onDevice = false,
    ListenMode listenMode = ListenMode.confirmation,
    sampleRate = 0,
    SpeechListenOptions? listenOptions,
  }) async {
    listens++;
  }

  @override
  Future<void> stop() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  test('the second SpeechCapture still gets its own status callbacks',
      () async {
    final speech = _SingletonSpeech();
    final first = SpeechCapture(speech);
    final second = SpeechCapture(speech);

    await first.start((_) {});
    await first.stop();
    await second.start((_) {});
    expect(speech.listens, 2);

    speech.statusListener!('done'); // platform stops on silence
    // Listeners must be bound to `second` (the latest start): it restarts.
    expect(speech.listens, 3);
  });
}
