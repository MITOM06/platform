import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/utils/global_messenger.dart';
import 'package:platform_client/core/widgets/pon_widgets.dart';
import 'package:platform_client/features/auth/ui/widgets/backup_codes_panel.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import 'mfa_test_data.dart';

const _codes = ['AAAA1-BBBB1', 'AAAA2-BBBB2'];

/// Wired to [rootNavigatorKey] so the real top banner shows the copy result.
Future<void> _pump(WidgetTester tester, {VoidCallback? onConfirm}) async {
  await tester.pumpWidget(MaterialApp(
    navigatorKey: rootNavigatorKey,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('en'),
    home: Scaffold(
      body: BackupCodesPanel(
        codes: _codes,
        confirmLabel: 'Continue',
        onConfirm: onConfirm ?? () {},
      ),
    ),
  ));
  await tester.pumpAndSettle();
}

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(BackupCodesPanel)));

Checkbox _box(WidgetTester tester) =>
    tester.widget<Checkbox>(find.byKey(const ValueKey('mfa-saved-checkbox')));

PonButton _continue(WidgetTester tester) =>
    tester.widget<PonButton>(find.byKey(const ValueKey('mfa-codes-continue')));

Future<void> _tapCopy(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('mfa-copy-codes')));
  await tester.pumpAndSettle();
}

/// Lets the banner run out: a leftover one would break the next test's overlay.
Future<void> _finishBanner(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 4));
  await tester.pumpAndSettle();
}

void main() {
  group('BackupCodesPanel: the checkbox is locked until the codes were copied',
      () {
    testWidgets('starts locked: hint visible, box and label cannot tick it',
        (tester) async {
      await _pump(tester);
      final l10n = _l10n(tester);

      expect(_box(tester).onChanged, isNull);
      expect(_continue(tester).onPressed, isNull);
      expect(find.text(l10n.mfaCopyCodesFirst), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('mfa-saved-checkbox')));
      await tester.tap(find.text(l10n.mfaSavedCheckbox));
      await tester.pumpAndSettle();

      expect(_box(tester).value, isFalse);
      expect(_continue(tester).onPressed, isNull);
    });

    testWidgets('a successful Copy unlocks it; ticking then enables Continue',
        (tester) async {
      final written = <String>[];
      var confirmed = 0;
      mockClipboard(tester, written: written);
      await _pump(tester, onConfirm: () => confirmed++);
      final l10n = _l10n(tester);

      await _tapCopy(tester);

      expect(written, ['AAAA1-BBBB1\nAAAA2-BBBB2']);
      expect(find.text(l10n.mfaCodesCopied), findsOneWidget);
      expect(find.text(l10n.mfaCopyCodesFirst), findsNothing);
      expect(_box(tester).onChanged, isNotNull);
      // Unlocked is not ticked: the user still has to confirm.
      expect(_box(tester).value, isFalse);
      expect(_continue(tester).onPressed, isNull);

      await tester.tap(find.byKey(const ValueKey('mfa-saved-checkbox')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('mfa-codes-continue')));
      await tester.pumpAndSettle();
      expect(confirmed, 1);

      await _finishBanner(tester);
    });

    testWidgets('a failed Copy stays locked with a localized error; retry works',
        (tester) async {
      mockClipboard(tester,
          failWith: PlatformException(code: 'raw_clipboard_error'));
      await _pump(tester);
      final l10n = _l10n(tester);

      await _tapCopy(tester);

      expect(find.text(l10n.mfaCodesCopyFailed), findsOneWidget);
      expect(find.text(l10n.mfaCodesCopied), findsNothing);
      expect(find.textContaining('raw_clipboard_error'), findsNothing);
      expect(find.textContaining('PlatformException'), findsNothing);
      expect(_box(tester).onChanged, isNull);
      expect(find.text(l10n.mfaCopyCodesFirst), findsOneWidget);
      await _finishBanner(tester);

      // The failure is not final: the next Copy that works unlocks it.
      mockClipboard(tester);
      await _tapCopy(tester);
      expect(_box(tester).onChanged, isNotNull);
      await _finishBanner(tester);
    });
  });
}
