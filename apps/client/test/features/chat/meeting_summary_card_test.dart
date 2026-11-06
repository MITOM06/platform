import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/theme/app_theme.dart';
import 'package:platform_client/features/chat/ui/widgets/meeting_summary_card.dart';
import 'package:platform_client/l10n/app_localizations.dart';

Future<AppLocalizations> pump(WidgetTester tester, Object content) async {
  await tester.pumpWidget(MaterialApp(
    theme: AppTheme.lightTheme,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('en'),
    home: Scaffold(
        body: SingleChildScrollView(
            child: MeetingSummaryCard(content: jsonEncode(content)))),
  ));
  await tester.pumpAndSettle();
  return AppLocalizations.of(tester.element(find.byType(MeetingSummaryCard)));
}

void main() {
  testWidgets('old group-call format: string action items, no new sections',
      (tester) async {
    final l = await pump(tester, {
      'attendees': ['An', 'Binh'],
      'durationSec': 3725,
      'overview': 'We talked',
      'keyPoints': ['kp1'],
      'actionItems': ['call vendor'],
    });
    expect(find.text('We talked'), findsOneWidget);
    expect(find.text('kp1'), findsOneWidget);
    expect(find.text('call vendor'), findsOneWidget);
    expect(find.text(l.meetingSummaryAttendees('An, Binh')), findsOneWidget);
    expect(find.text(l.meetingSummaryDuration('1:02:05')), findsOneWidget);
    expect(find.text(l.meetingSummaryDecisions.toUpperCase()), findsNothing);
    expect(find.text(l.meetingSummaryFromMaterials.toUpperCase()), findsNothing);
  });

  testWidgets('new meeting format: title, decisions, assignee, materials',
      (tester) async {
    final l = await pump(tester, {
      'title': 'Weekly sync',
      'attendees': ['Lan'],
      'durationSec': 90,
      'overview': 'o',
      'keyPoints': ['kp'],
      'decisions': ['go with B'],
      'actionItems': [
        {'text': 'Ship it', 'assigneeName': 'Binh'},
        {'text': 'Write docs', 'assigneeName': null},
      ],
      'fromMaterials': ['spec.pdf'],
      'language': 'en',
    });
    expect(find.text('Weekly sync'), findsOneWidget);
    expect(find.text('go with B'), findsOneWidget);
    expect(find.text('Ship it — Binh'), findsOneWidget);
    expect(find.text('Write docs'), findsOneWidget);
    expect(find.text('spec.pdf'), findsOneWidget);
    expect(find.text(l.meetingSummaryDecisions.toUpperCase()), findsOneWidget);
    expect(find.text(l.meetingSummaryFromMaterials.toUpperCase()), findsOneWidget);
    expect(find.text(l.meetingSummaryDuration('1:30')), findsOneWidget);
  });

  testWidgets('malformed content shows "summary unavailable"', (tester) async {
    final l = await pump(tester, 'garbage');
    expect(tester.takeException(), isNull);
    expect(find.text(l.meetingSummaryUnavailable), findsOneWidget);
    expect(find.text(l.meetingSummaryTitle), findsNothing);
  });
}
