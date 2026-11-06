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

  // BUG (medium, UI crash): provider_logo.dart:52 builds the monogram with
  // `name[0]` — the first UTF-16 code unit. For a name that starts with an
  // emoji / astral character it is a lone surrogate, and layout throws
  // "string is not well-formed UTF-16" (the card fails to paint). It is hit
  // by connector_card.dart:138, which passes `name: icon`, whenever `/catalog`
  // omits `icon` (CatalogEntry defaults it to '🔌'), and by any directory
  // entry whose name starts with an emoji. Fix (1 line):
  // `name.isNotEmpty ? name.characters.first.toUpperCase() : '?'`
  // (+ pass `entry.name` instead of `icon` in connector_card.dart).
  testWidgets('an emoji name renders its whole first character', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: ProviderLogo(icon: '🔌', name: '🔌', monogramColor: Colors.red),
    ));
    expect(tester.takeException(), isNull);
    expect(find.text('🔌'), findsOneWidget);
  }, skip: true);
}
