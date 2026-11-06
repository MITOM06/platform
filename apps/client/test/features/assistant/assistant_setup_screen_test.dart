import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/utils/global_messenger.dart';
import 'package:platform_client/features/assistant/data/assistant_repository.dart';
import 'package:platform_client/features/assistant/state/assistant_provider.dart';
import 'package:platform_client/features/assistant/ui/assistant_setup_screen.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import '../integrations/list_tile_ink_bug.dart';
import '../integrations/route_adapter.dart';

late RouteAdapter _api;

Future<void> _pump(WidgetTester tester) async {
  tester.view.physicalSize = const Size(800, 1600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      assistantRepositoryProvider
          .overrideWithValue(AssistantRepository(dioWith(_api))),
    ],
    child: MaterialApp(
      navigatorKey: rootNavigatorKey,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: const AssistantSetupScreen(),
    ),
  ));
  await tester.pumpAndSettle();
}

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(AssistantSetupScreen)));

String _continue(WidgetTester tester) => MaterialLocalizations.of(
        tester.element(find.byType(AssistantSetupScreen)))
    .continueButtonLabel;

Future<void> _next(WidgetTester tester) async {
  await tester.pumpAndSettle(); // let a just-typed name enable the button
  await tester.tap(find.text(_continue(tester)));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    _api = RouteAdapter({
      'GET /api/assistant/me': const Reply(404, {}),
      'GET /api/assistant/providers': const Reply(200, [
        {'id': 'p1', 'label': 'Claude Sonnet', 'provider': 'anthropic', 'model': 's'},
        {'id': 'p2', 'label': 'GPT', 'provider': 'openai', 'model': 'g'},
      ]),
    });
  });

  testWidgets('name and model are required before moving on',
      (tester) => toleratingListTileInkBug(() async {
            await _pump(tester);
            final l10n = _l10n(tester);
            expect(find.text(l10n.assistantSetupStepName), findsOneWidget);
            // Empty / blank name → cannot advance.
            await tester.enterText(find.byType(TextField).first, '   ');
            await _next(tester);
            expect(find.text(l10n.assistantSetupStepName), findsOneWidget);

            await tester.enterText(find.byType(TextField).first, 'Max');
            await _next(tester);
            expect(find.text(l10n.assistantSetupStepPersona), findsOneWidget);
            await _next(tester);
            expect(find.text(l10n.assistantSetupStepModel), findsOneWidget);
            // No model picked → stuck on the model step.
            await _next(tester);
            expect(find.text(l10n.assistantSetupStepModel), findsOneWidget);
            await tester.tap(find.text('GPT'));
            await tester.pumpAndSettle();
            await _next(tester);
            expect(find.text(l10n.assistantSetupStepConfirm), findsOneWidget);
            expect(find.text(l10n.assistantSetupCreateButton), findsOneWidget);
          }));

  testWidgets('re-running over an existing assistant pre-fills it',
      (tester) => toleratingListTileInkBug(() async {
            _api.routes['GET /api/assistant/me'] = const Reply(200, {
              'botUserId': 'b1',
              'name': 'Jarvis',
              'systemPrompt': 'Be brief',
              'providerId': 'p1',
            });
            await _pump(tester);
            expect(find.text('Jarvis'), findsOneWidget);
            await _next(tester);
            expect(find.text('Be brief'), findsOneWidget);
            await _next(tester);
            // The stored model is already selected → can continue.
            await _next(tester);
            expect(find.text(_l10n(tester).assistantSetupStepConfirm),
                findsOneWidget);
          }));

  testWidgets('a refused setup shows the localized reason and stays put',
      (tester) => toleratingListTileInkBug(() async {
            _api.routes['POST /api/assistant/setup'] = const Reply(400, {
              'code': 'ASSISTANT_SETUP_INCOMPLETE',
              'message': 'systemPrompt must not be empty'
            });
            await _pump(tester);
            final l10n = _l10n(tester);
            await tester.enterText(find.byType(TextField).first, ' Max ');
            await _next(tester);
            await _next(tester);
            await tester.tap(find.text('Claude Sonnet'));
            await tester.pumpAndSettle();
            await _next(tester);
            await tester.tap(find.text(l10n.assistantSetupCreateButton));
            await tester.pumpAndSettle();

            expect(_api.calls('POST', '/api/assistant/setup').single.data,
                {'name': 'Max', 'providerId': 'p1'});
            expect(find.text(l10n.errAssistantSetupIncomplete), findsOneWidget);
            expect(find.textContaining('must not be empty'), findsNothing);
            // Button usable again for a retry.
            expect(find.text(l10n.assistantSetupCreateButton), findsOneWidget);
            await tester.pump(const Duration(seconds: 4));
            await tester.pumpAndSettle();
          }));
}
