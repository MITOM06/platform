import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/ui/widgets/call_controls.dart';
import 'package:platform_client/l10n/app_localizations.dart';

Widget _wrap(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('voice call: mic, speaker and hang-up', (tester) async {
    final taps = <String>[];
    await tester.pumpWidget(_wrap(CallControls(
      isVideo: false,
      micOn: true,
      cameraOn: false,
      speakerOn: false,
      onToggleMic: () => taps.add('mic'),
      onToggleCamera: () => taps.add('cam'),
      onSwitchCamera: () => taps.add('switch'),
      onToggleSpeaker: () => taps.add('speaker'),
      onHangUp: () => taps.add('hangup'),
    )));
    expect(find.byTooltip('Toggle microphone'), findsOneWidget);
    expect(find.byTooltip('Speaker'), findsOneWidget);
    expect(find.byTooltip('Toggle camera'), findsNothing);
    expect(find.byTooltip('Switch camera'), findsNothing);

    await tester.tap(find.byTooltip('Toggle microphone'));
    await tester.tap(find.byTooltip('Speaker'));
    await tester.tap(find.byTooltip('End call'));
    expect(taps, ['mic', 'speaker', 'hangup']);
  });

  testWidgets('video call: mic, camera, switch camera and hang-up',
      (tester) async {
    final taps = <String>[];
    await tester.pumpWidget(_wrap(CallControls(
      isVideo: true,
      micOn: false,
      cameraOn: true,
      speakerOn: true,
      onToggleMic: () => taps.add('mic'),
      onToggleCamera: () => taps.add('cam'),
      onSwitchCamera: () => taps.add('switch'),
      onToggleSpeaker: () => taps.add('speaker'),
      onHangUp: () => taps.add('hangup'),
    )));
    expect(find.byTooltip('Speaker'), findsNothing);
    expect(find.byIcon(Icons.mic_off_rounded), findsOneWidget); // mic is off

    await tester.tap(find.byTooltip('Toggle camera'));
    await tester.tap(find.byTooltip('Switch camera'));
    expect(taps, ['cam', 'switch']);
  });
}
