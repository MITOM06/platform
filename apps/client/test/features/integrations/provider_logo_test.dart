import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/integrations/ui/widgets/provider_logo.dart';

Future<void> _pump(WidgetTester tester, String icon, String name) => tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProviderLogo(icon: icon, name: name, monogramColor: Colors.red),
        ),
      ),
    );

void main() {
  test('every MCP directory provider web shows a logo for has one on mobile too', () {
    for (final id in [
      'asana',
      'atlassian',
      'github',
      'huggingface',
      'linear',
      'notion',
      'sentry',
      'stripe',
      'gmail',
      'calendar',
      'drive',
    ]) {
      expect(providerLogoUrls[id], isNotNull, reason: id);
    }
  });

  testWidgets('a known provider renders its brand logo, matched case-insensitively', (tester) async {
    await _pump(tester, 'GitHub', 'GitHub');
    expect(find.byType(Image), findsOneWidget);
    expect(find.text('G'), findsNothing);
  });

  testWidgets('an unknown provider falls back to the name monogram', (tester) async {
    await _pump(tester, 'acme', 'acme tools');
    expect(find.byType(Image), findsNothing);
    expect(find.text('A'), findsOneWidget);
  });
}
