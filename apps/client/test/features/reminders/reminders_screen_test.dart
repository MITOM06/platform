// RemindersScreen: empty / error / list states, and done / delete go through a
// confirmation dialog (cancel keeps the reminder, OK removes it).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:platform_client/features/reminders/reminder_repository.dart';
import 'package:platform_client/features/reminders/reminders_screen.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import '../chat/data/recording_adapter.dart';

Map<String, dynamic> _json(String id) => {
      'id': id,
      'userId': 'u1',
      'conversationId': 'c1',
      'text': 'Call $id',
      'remindAt': '2026-02-01T09:00:00Z',
      'createdAt': '2026-01-01T00:00:00Z',
    };

/// Dio's response pipeline needs the real event loop.
Future<void> settle(WidgetTester t) async {
  await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
  await t.pumpAndSettle();
}

void main() {
  late RecordingAdapter http;

  setUpAll(() => initializeDateFormatting('en'));
  setUp(() => http = RecordingAdapter());

  Future<AppLocalizations> pump(WidgetTester tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        reminderRepositoryProvider
            .overrideWithValue(ReminderRepository(recordingDio(http))),
      ],
      child: const MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: Locale('en'),
        home: RemindersScreen(),
      ),
    ));
    await settle(tester);
    return AppLocalizations.of(tester.element(find.byType(Scaffold)));
  }

  testWidgets('empty list shows the empty state', (tester) async {
    http.on('GET', '/api/reminders', <Object>[]);
    final l = await pump(tester);
    expect(find.text(l.reminders), findsOneWidget);
    expect(find.text(l.remindersEmpty), findsOneWidget);
  });

  testWidgets('a load error shows a friendly message, not the raw error',
      (tester) async {
    http.on('GET', '/api/reminders', {'code': 'X'}, status: 500);
    final l = await pump(tester);
    expect(find.text(l.errServer), findsOneWidget);
  });

  testWidgets('lists reminders with their time; done asks then removes',
      (tester) async {
    http.on('GET', '/api/reminders', [_json('a'), _json('b')]);
    http.on('PATCH', '/api/reminders/a/done', {..._json('a'), 'done': true});
    final l = await pump(tester);
    expect(find.text('Call a'), findsOneWidget);
    expect(find.text('Call b'), findsOneWidget);
    expect(find.textContaining('2026'), findsNWidgets(2));

    // Cancel keeps it.
    await tester.tap(find.byTooltip(l.reminderDone).first);
    await tester.pumpAndSettle();
    expect(find.text(l.reminderDone), findsWidgets);
    await tester.tap(find.text(l.actionCancel));
    await tester.pumpAndSettle();
    expect(find.text('Call a'), findsOneWidget);
    expect(http.requests.where((r) => r.method == 'PATCH'), isEmpty);

    // OK marks it done and drops it.
    await tester.tap(find.byTooltip(l.reminderDone).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text(l.actionOk));
    await settle(tester);
    expect(http.requests.last.method, 'PATCH');
    expect(find.text('Call a'), findsNothing);
    expect(find.text('Call b'), findsOneWidget);
  });

  testWidgets('delete asks for confirmation then removes', (tester) async {
    http.on('GET', '/api/reminders', [_json('a')]);
    final l = await pump(tester);
    await tester.tap(find.byIcon(Icons.delete_outline_rounded));
    await tester.pumpAndSettle();
    expect(find.text(l.reminderDeleteConfirm), findsOneWidget);
    await tester.tap(find.text(l.actionOk));
    await settle(tester);
    expect(http.requests.last.method, 'DELETE');
    expect(http.requests.last.path, '/api/reminders/a');
    expect(find.text(l.remindersEmpty), findsOneWidget);
  });
}
