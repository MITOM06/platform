import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/providers/locale_provider.dart';
import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/state/capabilities_provider.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/settings/ui/settings_screen.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../helpers/noop_media_token.dart';

const _user = UserModel(
    id: '6e3f00aa11bb22cc33dd44ee',
    email: 'mia@acme.com',
    displayName: 'Mia',
    hasPassword: true);

class _Auth extends AuthNotifier {
  int logouts = 0;
  @override
  Future<AuthState> build() async => const AuthAuthenticated(_user);
  @override
  Future<void> logout() async => logouts++;
}

class _Caps extends CapabilitiesNotifier {
  _Caps(this._perms);
  final List<String> _perms;
  @override
  Future<MeCapabilities> build() async =>
      MeCapabilities.fromJson({'perms': _perms});
}

/// Mirrors main.dart: the app locale follows [localeNotifierProvider].
class _App extends ConsumerWidget {
  const _App();
  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: ref.watch(localeNotifierProvider) ?? const Locale('en'),
        home: const SettingsScreen(),
      );
}

late _Auth _auth;

Future<SharedPreferences> _pump(WidgetTester tester,
    {List<String> perms = const [], Map<String, Object> prefs = const {}}) async {
  tester.view.physicalSize = const Size(1080, 4000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues(prefs);
  final sp = await SharedPreferences.getInstance();
  _auth = _Auth();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(sp),
      authNotifierProvider.overrideWith(() => _auth),
      capabilitiesProvider.overrideWith(() => _Caps(perms)),
      noopMediaTokenOverride,
    ],
    child: const _App(),
  ));
  await tester.pumpAndSettle();
  return sp;
}

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(SettingsScreen)));

void main() {
  testWidgets('shows name + email, never the raw user id', (tester) async {
    await _pump(tester);
    expect(find.text('Mia'), findsOneWidget);
    expect(find.text('mia@acme.com'), findsOneWidget);
    expect(find.textContaining('6e3f00aa'), findsNothing);
  });

  testWidgets('changing the language persists it and re-localizes the screen',
      (tester) async {
    final sp = await _pump(tester);
    final en = _l10n(tester);
    expect(find.text('English'), findsOneWidget);

    await tester.tap(find.text(en.language));
    await tester.pumpAndSettle();
    expect(find.text(en.chooseLanguageTitle), findsOneWidget);
    await tester.tap(find.text('Tiếng Việt'));
    await tester.pumpAndSettle();

    expect(sp.getString('app_locale'), 'vi');
    final vi = _l10n(tester);
    expect(vi.localeName, 'vi');
    expect(find.text(vi.settingsTitle), findsOneWidget);
    expect(find.text('Tiếng Việt'), findsOneWidget);
  });

  testWidgets('a saved language is restored on start', (tester) async {
    await _pump(tester, prefs: {'app_locale': 'ja'});
    expect(_l10n(tester).localeName, 'ja');
    expect(find.text('日本語'), findsOneWidget);
  });

  testWidgets('notifications switch persists', (tester) async {
    final sp = await _pump(tester);
    final sw = find.byType(Switch);
    expect(tester.widget<Switch>(sw).value, isTrue);
    await tester.tap(sw);
    await tester.pumpAndSettle();
    expect(sp.getBool('notifications_enabled'), isFalse);
    expect(tester.widget<Switch>(sw).value, isFalse);
  });

  testWidgets('theme choice persists', (tester) async {
    final sp = await _pump(tester);
    final en = _l10n(tester);
    await tester.tap(find.text(en.appearance));
    await tester.pumpAndSettle();
    await tester.tap(find.text(en.themeDark).last);
    await tester.pumpAndSettle();
    expect(sp.getKeys().any((k) => sp.get(k).toString().contains('dark')),
        isTrue);
    expect(find.text(en.themeDark), findsOneWidget);
  });

  testWidgets('no admin entry without an admin-section capability',
      (tester) async {
    await _pump(tester, perms: const [Cap.usePersonalAssistant]);
    expect(find.text(_l10n(tester).adminMenu), findsNothing);
  });

  testWidgets('admin entry for a member manager', (tester) async {
    await _pump(tester, perms: const [Cap.manageMembers]);
    expect(find.text(_l10n(tester).adminMenu), findsOneWidget);
  });

  testWidgets('logout asks first: cancel keeps the session, confirm signs out',
      (tester) async {
    await _pump(tester);
    final en = _l10n(tester);
    await tester.tap(find.text(en.actionLogout));
    await tester.pumpAndSettle();
    expect(find.text(en.logoutConfirmBody), findsOneWidget);
    await tester.tap(find.text(en.actionCancel));
    await tester.pumpAndSettle();
    expect(_auth.logouts, 0);

    await tester.tap(find.text(en.actionLogout));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, en.actionLogout));
    await tester.pumpAndSettle();
    expect(_auth.logouts, 1);
  });
}
