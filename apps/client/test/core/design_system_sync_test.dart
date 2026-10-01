import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/theme/app_theme.dart';

/// Keeps the Flutter client on the web design system (docs/design-system.md).
/// Each check is one of the drifts found and fixed on 2026-10-01; they fail if
/// the drift comes back.
void main() {
  final themes = {'light': AppTheme.lightTheme, 'dark': AppTheme.darkTheme};

  group('theme matches the web tokens', () {
    for (final entry in themes.entries) {
      final theme = entry.value;
      final dark = entry.key == 'dark';

      test('${entry.key}: Geist is the app typeface', () {
        expect(theme.textTheme.bodyMedium?.fontFamily, AppTheme.fontSans);
        expect(theme.appBarTheme.titleTextStyle?.fontFamily, AppTheme.fontSans);
      });

      test('${entry.key}: no Material baseline colour leaks into the scheme', () {
        final s = theme.colorScheme;
        final accent = dark ? AppTheme.darkAccent : AppTheme.lightAccent;
        final tint = dark ? AppTheme.darkAccentTint : AppTheme.lightAccentTint;
        expect([s.primary, s.secondary, s.tertiary], everyElement(accent));
        expect(
          [s.primaryContainer, s.secondaryContainer, s.tertiaryContainer],
          everyElement(tint),
        );
        expect(s.surfaceContainerHighest,
            dark ? AppTheme.darkMuted : AppTheme.lightMuted);
      });

      test('${entry.key}: controls are 10px, at least 44 high, weight <= 600',
          () {
        final filled = theme.filledButtonTheme.style!;
        expect(filled.minimumSize!.resolve({})!.height, 44);
        expect(filled.textStyle!.resolve({})!.fontWeight, FontWeight.w600);
        final shape = filled.shape!.resolve({})! as RoundedRectangleBorder;
        expect(shape.borderRadius, BorderRadius.circular(10));

        final outlined = theme.outlinedButtonTheme.style!;
        expect(outlined.shape!.resolve({}), isA<RoundedRectangleBorder>());
        expect(outlined.foregroundColor!.resolve({}),
            dark ? AppTheme.darkText : AppTheme.lightText);
      });

      test('${entry.key}: page title is 600, not bold', () {
        expect(theme.appBarTheme.titleTextStyle?.fontWeight, FontWeight.w600);
      });

      test('${entry.key}: field hint and label use the warm muted token', () {
        final muted = dark ? AppTheme.darkTextMuted : AppTheme.lightTextMuted;
        expect(theme.inputDecorationTheme.hintStyle?.color, muted);
        expect(theme.inputDecorationTheme.labelStyle?.color, muted);
      });
    }

    testWidgets('AppTheme.accent resolves per mode', (tester) async {
      for (final entry in themes.entries) {
        late Color resolved;
        await tester.pumpWidget(MaterialApp(
          // A fresh app per mode: reusing one animates the theme change.
          key: ValueKey(entry.key),
          theme: entry.value,
          home: Builder(builder: (context) {
            resolved = AppTheme.accent(context);
            return const SizedBox();
          }),
        ));
        expect(
          resolved,
          entry.key == 'dark' ? AppTheme.darkAccent : AppTheme.lightAccent,
        );
      }
    });
  });

  group('source conventions', () {
    final sources = Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) =>
            f.path.endsWith('.dart') &&
            !f.path.endsWith('.g.dart') &&
            !f.path.contains('/l10n/'))
        .toList();

    List<String> offenders(RegExp pattern, {bool Function(String)? skip}) => [
          for (final f in sources)
            if (!(skip?.call(f.path) ?? false))
              for (final (i, line) in f.readAsLinesSync().indexed)
                if (pattern.hasMatch(line)) '${f.path}:${i + 1}',
        ];

    test('weights stop at 600 (web uses 400 / 500 / 600)', () {
      final hits = offenders(
        RegExp(r'FontWeight\.(bold|w700|w800|w900)'),
        // The PON wordmark is the one bold element.
        skip: (p) => p.endsWith('core/widgets/pon_widgets.dart'),
      );
      expect(hits, isEmpty);
    });

    test('font sizes stay on the web scale (no 13 / 15 / half sizes)', () {
      expect(
        offenders(RegExp(r'fontSize: *(13|15|9\.5|11\.5|12\.5|13\.5|14\.5)\b')),
        isEmpty,
      );
    });

    test('no generic monospace: code uses Geist Mono', () {
      expect(offenders(RegExp(r"fontFamily: *'monospace'")), isEmpty);
    });

    test('raw exception text is never shown to the user', () {
      expect(
        offenders(RegExp(
            r"""(Text\(\s*'\$e'|message: '\$e'|showErrorSnackBar\('\$e'\)|_error = '\$e')""")),
        isEmpty,
      );
    });

    test('switches take their colours from the theme', () {
      expect(offenders(RegExp(r'activeThumbColor:')), isEmpty);
    });
  });
}
