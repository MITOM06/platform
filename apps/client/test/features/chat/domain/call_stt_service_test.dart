// SpeechCapture / CallSttService: only FINAL, non-empty results are published
// as `/app/call.transcript`; unavailable recognizers and permission errors
// stop instead of looping; late results after stop are dropped.

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_stt_service.dart';
import 'package:speech_to_text/speech_recognition_error.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

import 'call_test_stomp.dart';

class _Speech implements SpeechToText {
  _Speech({this.available = true, this.initThrows = false, this.listenThrows = false});

  bool available;
  bool initThrows;
  bool listenThrows;
  int listens = 0, stops = 0;
  SpeechResultListener? onResult;

  @override
  SpeechErrorListener? errorListener;
  @override
  SpeechStatusListener? statusListener;

  @override
  Future<bool> initialize({
    SpeechErrorListener? onError,
    SpeechStatusListener? onStatus,
    debugLogging = false,
    Duration finalTimeout = const Duration(milliseconds: 2000),
    List<SpeechConfigOption>? options,
  }) async {
    if (initThrows) throw StateError('no recognizer');
    return available;
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
    this.onResult = onResult;
    if (listenThrows) throw StateError('busy');
  }

  @override
  Future<void> stop() async => stops++;

  void say(String words, {bool last = true}) => onResult!(SpeechRecognitionResult(
      [SpeechRecognitionWords(words, null, 0.9)],
      last ? ResultType.finalResult.value : ResultType.partial.value));

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  group('SpeechCapture', () {
    test('final results are trimmed and delivered; interim / blank are not',
        () async {
      final speech = _Speech();
      final cap = SpeechCapture(speech);
      final got = <String>[];
      expect(await cap.start(got.add), isTrue);
      expect(cap.running, isTrue);
      speech.say('  hello there ');
      speech.say('partial', last: false);
      speech.say('   ');
      expect(got, ['hello there']);
    });

    test('unavailable or failing initialize → false, not running', () async {
      final cap = SpeechCapture(_Speech(available: false));
      expect(await cap.start((_) {}), isFalse);
      expect(cap.running, isFalse);
      final cap2 = SpeechCapture(_Speech(initThrows: true));
      expect(await cap2.start((_) {}), isFalse);
      expect(cap2.running, isFalse);
    });

    test('a listen failure is swallowed (still reported started)', () async {
      final speech = _Speech(listenThrows: true);
      expect(await SpeechCapture(speech).start((_) {}), isTrue);
      expect(speech.listens, 1);
    });

    test('silence ("done") restarts listening while running', () async {
      final speech = _Speech();
      final cap = SpeechCapture(speech);
      await cap.start((_) {});
      speech.statusListener!('notListening');
      expect(speech.listens, 2);
      speech.statusListener!('listening');
      expect(speech.listens, 2);
      await cap.stop();
      speech.statusListener!('done');
      expect(speech.listens, 2);
    });

    test('a permission error stops and reports blocked; others keep going',
        () async {
      final speech = _Speech();
      final cap = SpeechCapture(speech);
      var blocked = 0;
      await cap.start((_) {}, onBlocked: () => blocked++);
      speech.errorListener!(SpeechRecognitionError('error_network', false));
      expect(cap.running, isTrue);
      expect(blocked, 0);
      speech.errorListener!(
          SpeechRecognitionError('error_insufficient_PERMISSIONS', true));
      expect(cap.running, isFalse);
      expect(blocked, 1);
      expect(speech.stops, 1);
    });

    test('a late result after stop is dropped', () async {
      final speech = _Speech();
      final cap = SpeechCapture(speech);
      final got = <String>[];
      await cap.start(got.add);
      await cap.stop();
      speech.say('late');
      expect(got, isEmpty);
    });
  });

  group('CallSttService', () {
    test('publishes each final result with the call id', () async {
      final stomp = RecordingStomp();
      final speech = _Speech();
      final stt = CallSttService(stomp, speech);
      expect(await stt.start('k1'), isTrue);
      expect(stt.isRunning, isTrue);
      speech.say('action item: ship it');
      final sent = stomp.to('/app/call.transcript');
      expect(sent.single['callId'], 'k1');
      expect(sent.single['text'], 'action item: ship it');
      expect(sent.single['ts'], isA<int>());
    });

    test('stop clears the call id: nothing is published afterwards',
        () async {
      final stomp = RecordingStomp();
      final speech = _Speech();
      final stt = CallSttService(stomp, speech);
      await stt.start('k1');
      final listener = speech.onResult!;
      await stt.stop();
      expect(stt.isRunning, isFalse);
      listener(SpeechRecognitionResult(
          [const SpeechRecognitionWords('x', null, 1)],
          ResultType.finalResult.value));
      expect(stomp.sent, isEmpty);
    });
  });
}
