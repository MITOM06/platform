import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_sounds.dart';

class FakeTonePlayer implements TonePlayer {
  final calls = <String>[];
  @override
  Future<void> loop(CallTone tone, {bool speaker = false}) async =>
      calls.add('loop:${tone.name}:$speaker');
  @override
  Future<void> stop() async => calls.add('stop');
}

void main() {
  late FakeTonePlayer player;
  late int vibrations;
  late CallSounds sounds;

  setUp(() {
    player = FakeTonePlayer();
    vibrations = 0;
    sounds = CallSounds(player,
        vibrate: () => vibrations++,
        vibrateEvery: const Duration(milliseconds: 1500));
  });

  testWidgets('the ringtone loops and vibrates until stopped', (tester) async {
    await sounds.play(CallTone.ringtone);
    expect(player.calls, ['loop:ringtone:false']);
    expect(vibrations, 1);

    await tester.pump(const Duration(milliseconds: 3000));
    expect(vibrations, 3);

    await sounds.stop();
    await tester.pump(const Duration(milliseconds: 3000));
    expect(vibrations, 3);
    expect(player.calls.last, 'stop');
  });

  testWidgets('ringback does not vibrate and honours the speaker route',
      (tester) async {
    await sounds.play(CallTone.ringback, speaker: true);
    await tester.pump(const Duration(seconds: 5));
    expect(vibrations, 0);
    expect(player.calls, ['loop:ringback:true']);
    await sounds.stop();
  });

  testWidgets('playing the same tone twice does not restart it',
      (tester) async {
    await sounds.play(CallTone.ringtone);
    await sounds.play(CallTone.ringtone);
    expect(player.calls, ['loop:ringtone:false']);
    await sounds.stop();
  });

  testWidgets('stop without a tone does nothing', (tester) async {
    await sounds.stop();
    expect(player.calls, isEmpty);
  });

  group('audioContextFor', () {
    test('ringback joins the voice-call session instead of hijacking it', () {
      final ctx = audioContextFor(CallTone.ringback, speaker: false);
      expect(ctx.android.audioMode, AndroidAudioMode.inCommunication);
      expect(ctx.android.usageType, AndroidUsageType.voiceCommunication);
      expect(ctx.android.audioFocus, AndroidAudioFocus.none);
      expect(ctx.android.isSpeakerphoneOn, isFalse);
      expect(ctx.iOS.category, AVAudioSessionCategory.playAndRecord);
      expect(
          ctx.iOS.options,
          containsAll([
            AVAudioSessionOptions.allowBluetooth,
            AVAudioSessionOptions.allowBluetoothA2DP,
          ]));
      expect(ctx.iOS.options,
          isNot(contains(AVAudioSessionOptions.defaultToSpeaker)));
    });

    test('video-call ringback goes to the loudspeaker', () {
      final ctx = audioContextFor(CallTone.ringback, speaker: true);
      expect(ctx.android.isSpeakerphoneOn, isTrue);
      expect(ctx.iOS.options, contains(AVAudioSessionOptions.defaultToSpeaker));
    });

    test('the ringtone obeys the silent switch', () {
      // AudioContextConfig only builds the iOS half when running on iOS.
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      addTearDown(() => debugDefaultTargetPlatformOverride = null);
      expect(audioContextFor(CallTone.ringtone).iOS.category,
          AVAudioSessionCategory.ambient);
    });
  });
}
