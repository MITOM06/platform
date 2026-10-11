import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/ui/widgets/logout_reason_banner.dart';
import 'package:platform_client/l10n/app_localizations.dart';

class _FixedAuth extends AuthNotifier {
  _FixedAuth(this._state);
  final AuthState _state;
  @override
  Future<AuthState> build() async => _state;
}

Future<AppLocalizations> _pump(WidgetTester tester, AuthState state) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [authNotifierProvider.overrideWith(() => _FixedAuth(state))],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: Locale('en'),
      home: Scaffold(body: LogoutReasonBanner()),
    ),
  ));
  await tester.pumpAndSettle();
  return AppLocalizations.of(tester.element(find.byType(LogoutReasonBanner)));
}

void main() {
  testWidgets('a blocked account sees the localized blocked message',
      (tester) async {
    final l10n = await _pump(
        tester, const AuthUnauthenticated(reason: 'ACCOUNT_BLOCKED'));
    expect(find.text(l10n.authErrAccountBlocked), findsOneWidget);
    expect(find.textContaining('ACCOUNT_BLOCKED'), findsNothing);
  });

  testWidgets('a normal logout shows nothing', (tester) async {
    await _pump(tester, const AuthUnauthenticated());
    expect(find.byKey(const ValueKey('logout-reason')), findsNothing);
  });

  test('only allow-listed codes are logout reasons', () {
    expect(kLogoutReasons, {'ACCOUNT_BLOCKED', 'SSO_REQUIRED'});
  });

  testWidgets('SSO required: the localized SSO notice, never the raw code',
      (tester) async {
    final l10n = await _pump(
        tester, const AuthUnauthenticated(reason: 'SSO_REQUIRED'));
    expect(find.text(l10n.authErrSsoRequired), findsOneWidget);
    expect(find.byIcon(Icons.vpn_key_rounded), findsOneWidget);
    expect(find.textContaining('SSO_REQUIRED'), findsNothing);
  });

  testWidgets('a failed Google sign-in shows its notice, not the raw code',
      (tester) async {
    final l10n = await _pump(
        tester, const AuthUnauthenticated(reason: 'ACCOUNT_NOT_PROVISIONED'));
    expect(find.byKey(const ValueKey('logout-reason')), findsOneWidget);
    expect(find.textContaining('ACCOUNT_NOT_PROVISIONED'), findsNothing);
    expect(l10n, isNotNull);
  });

  test('sign-in notices cover the OAuth redirect errors', () {
    expect(kLoginNotices, containsAll(kLogoutReasons));
    expect(kLoginNotices,
        containsAll({'ACCOUNT_NOT_PROVISIONED', 'INVITATION_PENDING'}));
    // Google redirect `?error=SSO_REQUIRED` (contract 13 §C).
    expect(kLoginNotices, contains('SSO_REQUIRED'));
    expect(kLoginNotices.contains('SESSION_REVOKED'), isFalse);
  });
}
