import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/ui/room/ai_notes_indicator.dart';
import 'package:platform_client/l10n/app_localizations.dart';

Widget host(bool active, List<String> announced, {bool sharing = false}) =>
    MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Scaffold(
          body: AiNotesIndicator(
              active: active, sharing: sharing, announce: announced.add)),
    );

void main() {
  const active = 'AI is taking notes';
  const started = 'AI started taking notes for this meeting';

  testWidgets('indicator shows while aiNotes is on', (tester) async {
    await tester.pumpWidget(host(true, []));
    expect(find.text(active), findsOneWidget);
  });

  testWidgets('shows nothing while aiNotes is off', (tester) async {
    await tester.pumpWidget(host(false, []));
    expect(find.text(active), findsNothing);
  });

  testWidgets('banner shows once when aiNotes flips on mid-meeting',
      (tester) async {
    final announced = <String>[];
    await tester.pumpWidget(host(false, announced));
    expect(announced, isEmpty);
    await tester.pumpWidget(host(true, announced));
    expect(announced, [started]);
    await tester.pumpWidget(host(true, announced));
    expect(announced, [started]);
  });

  testWidgets('no banner when the room opens with aiNotes already on',
      (tester) async {
    final announced = <String>[];
    await tester.pumpWidget(host(true, announced));
    expect(announced, isEmpty);
  });

  testWidgets('sharer sees the screen-reading line only when sharing',
      (tester) async {
    const reading = 'AI is reading the screen you share';
    await tester.pumpWidget(host(true, []));
    expect(find.text(reading), findsNothing);
    await tester.pumpWidget(host(true, [], sharing: true));
    expect(find.text(reading), findsOneWidget);
    // Told apart by a screen icon, like web's MonitorUp.
    expect(find.byIcon(Icons.screen_share_rounded), findsOneWidget);
    expect(find.byIcon(Icons.auto_awesome_rounded), findsOneWidget);
    await tester.pumpWidget(host(false, [], sharing: true));
    expect(find.text(reading), findsNothing);
  });
}
