import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/providers/locale_provider.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// Structural guard for the ARB catalogues.
///
/// A locale that silently misses a key falls back to English at runtime — it still builds, still
/// runs, and only a user reading that language ever notices. A placeholder mismatch is worse:
/// `flutter gen-l10n` generates the method signature from `app_en.arb`, so a translation that
/// drops `{count}` compiles fine and then renders the wrong sentence. Neither is visible in a
/// diff review, so assert both. Mirrors `apps/web/lib/__tests__/i18n-parity.test.ts`.

const _templateLocale = 'en';

final _arbDir = Directory('lib/l10n');

Map<String, String> _load(String locale) {
  final raw = File('${_arbDir.path}/app_$locale.arb').readAsStringSync();
  final decoded = jsonDecode(raw) as Map<String, dynamic>;
  return {
    for (final e in decoded.entries)
      if (!e.key.startsWith('@')) e.key: e.value.toString(),
  };
}

/// Variable names referenced by an ICU message: `{name}`, `{count, plural, …}`.
///
/// The name must start with a letter or underscore so an explicit-value plural branch
/// (`=1{1 participant}`) is not mistaken for a placeholder called `1`.
List<String> _placeholders(String message) =>
    (RegExp(r'\{\s*([A-Za-z_][A-Za-z0-9_]*)')
        .allMatches(message)
        .map((m) => m.group(1)!)
        .toSet()
        .toList()
      ..sort());

void main() {
  final supported = kSupportedLocales.map((l) => l.languageCode).toList();
  final template = _load(_templateLocale);
  final others = supported.where((l) => l != _templateLocale);

  test('every supported locale has an ARB file, a native name and a delegate entry', () {
    for (final locale in supported) {
      expect(File('${_arbDir.path}/app_$locale.arb').existsSync(), isTrue,
          reason: 'missing app_$locale.arb');
      expect(kLanguageNames[locale], isNotNull, reason: 'missing native name for $locale');
      expect(
        AppLocalizations.supportedLocales.any((l) => l.languageCode == locale),
        isTrue,
        reason: '$locale is not in the generated AppLocalizations.supportedLocales',
      );
    }
  });

  test('no ARB file exists for an unsupported locale', () {
    final onDisk = _arbDir
        .listSync()
        .map((f) => f.uri.pathSegments.last)
        .where((n) => n.startsWith('app_') && n.endsWith('.arb'))
        .map((n) => n.substring(4, n.length - 4))
        .toList()
      ..sort();
    expect(onDisk, equals([...supported]..sort()));
  });

  for (final locale in others) {
    test('$locale defines exactly the keys app_en.arb defines', () {
      final target = _load(locale);
      expect(target.keys.where((k) => !template.containsKey(k)).toList()..sort(), isEmpty,
          reason: 'keys present in $locale but not in the en template');
      expect(template.keys.where((k) => !target.containsKey(k)).toList()..sort(), isEmpty,
          reason: 'keys missing from $locale');
    });

    test('$locale uses the same ICU placeholders as app_en.arb', () {
      final target = _load(locale);
      final mismatched = <String>[];
      for (final key in template.keys) {
        final translated = target[key];
        if (translated == null) continue;
        final a = _placeholders(template[key]!);
        final b = _placeholders(translated);
        if (a.join(',') != b.join(',')) {
          mismatched.add('$key: en=$a $locale=$b');
        }
      }
      expect(mismatched, isEmpty);
    });
  }

  for (final locale in supported) {
    test('$locale has no blank messages', () {
      final target = _load(locale);
      expect(target.keys.where((k) => target[k]!.trim().isEmpty).toList(), isEmpty);
    });

    test('$locale keeps the "other" branch on every plural', () {
      final target = _load(locale);
      final broken = target.keys.where((k) {
        final v = target[k]!;
        return RegExp(r',\s*plural\s*,').hasMatch(v) &&
            !RegExp(r'(^|\s)other\s*\{').hasMatch(v);
      }).toList();
      expect(broken, isEmpty);
    });
  }

  test('every placeholder used in app_en.arb is declared in its @metadata', () {
    final raw = jsonDecode(File('${_arbDir.path}/app_en.arb').readAsStringSync())
        as Map<String, dynamic>;
    final undeclared = <String>[];
    for (final entry in template.entries) {
      final used = _placeholders(entry.value);
      if (used.isEmpty) continue;
      final meta = raw['@${entry.key}'] as Map<String, dynamic>?;
      final declared = ((meta?['placeholders'] as Map<String, dynamic>?) ?? {}).keys.toSet();
      final missing = used.where((p) => !declared.contains(p)).toList();
      if (missing.isNotEmpty) undeclared.add('${entry.key}: $missing');
    }
    // gen-l10n needs the declaration to type the generated method argument.
    expect(undeclared, isEmpty);
  });
}
