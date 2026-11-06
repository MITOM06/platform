import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/integrations/data/models/connector_models.dart';
import 'package:platform_client/features/integrations/ui/widgets/provider_logo.dart';

void main() {
  test('a catalog entry without an icon falls back to the 🔌 emoji', () {
    expect(CatalogEntry.fromJson(const {'id': 'x', 'name': 'X'}).icon, '🔌');
  });

  testWidgets('ASCII monogram still works', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: ProviderLogo(icon: 'acme', name: 'acme', monogramColor: Colors.red),
    ));
    expect(find.text('A'), findsOneWidget);
  });

  // `name[0]` would be a lone UTF-16 surrogate for an emoji-led name and
  // crash text layout — the monogram must use the whole first grapheme.
  testWidgets('an emoji name renders its whole first character', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: ProviderLogo(icon: '🔌', name: '🔌', monogramColor: Colors.red),
    ));
    expect(tester.takeException(), isNull);
    expect(find.text('🔌'), findsOneWidget);
  });
}
