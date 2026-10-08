import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/theme/app_theme.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// Signed in as `me` without touching secure storage.
class HarnessAuth extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(
      UserModel(id: 'me', email: 'me@example.com', displayName: 'Me'));
}

/// Pumps [child] at '/' inside ProviderScope + MaterialApp.router (en) with
/// stub routes that render their location, so navigation can be asserted with
/// `find.text('/meet/abc-defg-hjk')`. Signed in as `me` unless [fakeAuth] is
/// false (then the caller overrides auth itself).
Future<void> pumpMeetingWidget(WidgetTester tester, Widget child,
    {List<Override> overrides = const [],
    Locale locale = const Locale('en'),
    bool fakeAuth = true,
    bool wrapInScaffold = true}) async {
  final router = GoRouter(routes: [
    GoRoute(
        path: '/',
        builder: (_, __) => wrapInScaffold ? Scaffold(body: child) : child),
    GoRoute(path: '/meet/:code', builder: (_, s) => Text(s.uri.path)),
    GoRoute(path: '/meetings/:id', builder: (_, s) => Text(s.uri.path)),
    GoRoute(path: '/meetings', builder: (_, s) => Text(s.uri.path)),
  ]);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      if (fakeAuth) authNotifierProvider.overrideWith(HarnessAuth.new),
      ...overrides,
    ],
    child: MaterialApp.router(
      routerConfig: router,
      locale: locale,
      theme: AppTheme.lightTheme,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  ));
  await tester.pumpAndSettle();
}

AppLocalizations l10nOf(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));
