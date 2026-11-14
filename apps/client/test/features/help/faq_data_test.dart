import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/help/domain/faq_data.dart';
import 'package:platform_client/l10n/app_localizations.dart';

void main() {
  test('5 categories, 20 items, ids unique and namespaced by category', () {
    expect(kFaqData.length, 5);
    expect(kFaqData.expand((c) => c.items).length, 20);
    final catIds = kFaqData.map((c) => c.id).toList();
    expect(catIds.toSet().length, catIds.length);
    final itemIds = kFaqData.expand((c) => c.items).map((i) => i.id).toList();
    expect(itemIds.toSet().length, itemIds.length);
    for (final c in kFaqData) {
      for (final i in c.items) {
        expect(i.id, startsWith('${c.id}.'), reason: i.id);
      }
    }
    expect(kFaqData.first.id, 'gettingStarted');
  });

  for (final locale in AppLocalizations.supportedLocales) {
    test('every title / question / answer resolves to text in $locale', () {
      final l = lookupAppLocalizations(locale);
      for (final c in kFaqData) {
        expect(c.title(l).trim(), isNotEmpty, reason: c.id);
        final questions = <String>{};
        for (final i in c.items) {
          final q = i.question(l);
          final a = i.answer(l);
          expect(q.trim(), isNotEmpty, reason: i.id);
          expect(a.trim(), isNotEmpty, reason: i.id);
          expect(q, isNot(a), reason: i.id);
          questions.add(q);
        }
        // Each question in a category is a different string.
        expect(questions.length, c.items.length, reason: c.id);
      }
    });
  }

  test('English copy matches the generated getters', () {
    final l = lookupAppLocalizations(const Locale('en'));
    expect(kFaqData.first.title(l), l.helpCatGettingStarted);
  });
}
