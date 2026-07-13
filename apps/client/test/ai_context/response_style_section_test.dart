import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/ai_context/data/ai_context_models.dart';
import 'package:platform_client/features/ai_context/ui/widgets/response_style_section.dart';
import 'package:platform_client/l10n/app_localizations.dart';

AiUserContext _ctx() => const AiUserContext(
      userId: 'u1',
      jobTitle: 'Dev',
      projects: ['PON'],
      style: 'brief',
      preferences: '',
    );

void main() {
  testWidgets('renders style + preferences fields and the Update button',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('en'),
          home: Scaffold(body: ResponseStyleSection(context: _ctx())),
        ),
      ),
    );
    await tester.pump();

    // Seeded from the context.
    expect(find.text('brief'), findsOneWidget);
    // The Update CTA is present.
    expect(find.text('Update'), findsOneWidget);
    // Two multiline inputs (style + preferences).
    expect(find.byType(TextField), findsNWidgets(2));
  });
}
