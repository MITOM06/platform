import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:platform_client/core/api/token_manager.dart';
import 'package:platform_client/core/router/route_guard.dart';
import 'package:platform_client/core/widgets/pon_widgets.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';
import 'package:platform_client/features/auth/domain/sso_info.dart';
import 'package:platform_client/features/auth/ui/forgot_password_screen.dart';
import 'package:platform_client/features/auth/ui/login_screen.dart';
import 'package:platform_client/features/auth/ui/widgets/sso_sign_in_button.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// Contract 13 §C on the sign-in side: `SSO_REQUIRED` is a login notice (not
/// a failed sign-in), the SSO button is emphasised, and a session revoked
/// because "Require SSO" was switched on explains itself on the login screen.

const _member =
    UserModel(id: 'u1', email: 'mia@acme.com', displayName: 'Mia');

DioException _codeError(int status, String code, {String path = '/x'}) {
  final req = RequestOptions(path: path);
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response:
        Response(requestOptions: req, statusCode: status, data: {'code': code}),
  );
}

class _FakeRepo implements AuthRepository {
  SsoInfo ssoInfo = SsoInfo.disabled;
  Object? loginError;
  Object? forgotError;
  SignInResult loginResult = const SignInSuccess(_member);
  final loginCalls = <String>[];

  @override
  Future<SsoInfo> getSsoInfo() async => ssoInfo;

  @override
  Future<SignInResult> login(String email, String password) async {
    loginCalls.add(email);
    final error = loginError;
    if (error != null) throw error;
    return loginResult;
  }

  @override
  Future<void> forgotPassword(String email) async {
    final error = forgotError;
    if (error != null) throw error;
  }

  @override
  Future<void> clearCredentials() async {}

  @override
  Future<void> updateFcmToken(String token) async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Real [AuthNotifier] logic, minus secure-storage restore.
class _TestAuth extends AuthNotifier {
  _TestAuth(this._initial);
  final AuthState _initial;

  @override
  Future<AuthState> build() async => _initial;
}

class _Harness {
  _Harness(this.container, this.router, this.repo);
  final ProviderContainer container;
  final GoRouter router;
  final _FakeRepo repo;

  AuthState? get auth => container.read(authNotifierProvider).valueOrNull;
  AuthNotifier get notifier => container.read(authNotifierProvider.notifier);
}

/// The real [LoginScreen] / [ForgotPasswordScreen] on a router wired like
/// `app_router.dart` (same [redirectForAuthState], refreshed on auth changes).
Future<_Harness> _pump(
  WidgetTester tester, {
  AuthState initial = const AuthUnauthenticated(),
  String location = '/login',
  _FakeRepo? repo,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  final fake = repo ?? _FakeRepo();
  final container = ProviderContainer(overrides: [
    authRepositoryProvider.overrideWithValue(fake),
    authNotifierProvider.overrideWith(() => _TestAuth(initial)),
  ]);
  addTearDown(container.dispose);

  final refresh = ValueNotifier<int>(0);
  addTearDown(refresh.dispose);
  container.listen(authNotifierProvider, (_, __) => refresh.value++);

  final router = GoRouter(
    initialLocation: location,
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = container.read(authNotifierProvider);
      if (auth.isLoading) return null;
      return redirectForAuthState(
        auth.valueOrNull,
        path: state.uri.path,
        onboardingCompleted: true,
      );
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const Text('home-page')),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(
          path: '/forgot-password',
          builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(
          path: '/verify-otp', builder: (_, __) => const Text('otp-page')),
      GoRoute(path: kMfaPath, builder: (_, __) => const Text('mfa-page')),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(UncontrolledProviderScope(
    container: container,
    child: MaterialApp.router(
      routerConfig: router,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
    ),
  ));
  // Let the staggered entrance timers fire, then settle.
  await tester.pump(const Duration(seconds: 1));
  await tester.pumpAndSettle();
  return _Harness(container, router, fake);
}

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));

Finder get _emphasisedSso => find.byKey(SsoSignInButton.emphasisedKey);
Finder get _plainSso => find.byKey(SsoSignInButton.plainKey);

Future<void> _submitLogin(WidgetTester tester) async {
  await tester.enterText(find.byType(TextFormField).at(0), 'mia@acme.com');
  await tester.enterText(find.byType(TextFormField).at(1), 'Secret123!');
  // The screen title reads the same as the button: tap the button.
  await tester.tap(find.widgetWithText(PonButton, _l10n(tester).loginButton));
  await tester.pumpAndSettle();
}

void main() {
  group('login screen', () {
    testWidgets(
        'password sign-in refused with SSO_REQUIRED → notice banner + '
        'emphasised SSO button, not an error', (tester) async {
      final repo = _FakeRepo()
        ..loginError = _codeError(403, 'SSO_REQUIRED', path: '/auth/login');
      final h = await _pump(tester, repo: repo);
      final l10n = _l10n(tester);
      // SSO not advertised before the refusal.
      expect(_emphasisedSso, findsNothing);
      expect(_plainSso, findsNothing);

      await _submitLogin(tester);

      expect(repo.loginCalls, ['mia@acme.com']);
      final auth = h.auth;
      expect(auth, isA<AuthUnauthenticated>());
      expect((auth as AuthUnauthenticated).reason, 'SSO_REQUIRED');
      expect(h.container.read(authNotifierProvider).hasError, isFalse);
      expect(find.text(l10n.authErrSsoRequired), findsOneWidget);
      expect(_emphasisedSso, findsOneWidget);
      expect(_plainSso, findsNothing);
      // No snackbar duplicate, and never the raw code.
      expect(find.byType(SnackBar), findsNothing);
      expect(find.textContaining('SSO_REQUIRED'), findsNothing);
      expect(h.router.routerDelegate.currentConfiguration.uri.path, '/login');
    });

    testWidgets('other sign-in errors still show as a snackbar',
        (tester) async {
      final repo = _FakeRepo()
        ..loginError = _codeError(401, 'ACCOUNT_LOCKED', path: '/auth/login');
      final h = await _pump(tester, repo: repo);

      await _submitLogin(tester);

      expect(h.container.read(authNotifierProvider).hasError, isTrue);
      expect(find.byType(SnackBar), findsOneWidget);
      expect(_emphasisedSso, findsNothing);
    });

    testWidgets('SSO offered but not enforced → plain SSO button',
        (tester) async {
      final repo = _FakeRepo()
        ..ssoInfo = const SsoInfo(enabled: true, buttonLabel: 'SSO');
      await _pump(tester, repo: repo);
      expect(_plainSso, findsOneWidget);
      expect(_emphasisedSso, findsNothing);
    });

    testWidgets('SSO enforced for some domains → emphasised for everyone',
        (tester) async {
      final repo = _FakeRepo()
        ..ssoInfo =
            const SsoInfo(enabled: true, enforced: true, buttonLabel: 'SSO');
      await _pump(tester, repo: repo);
      expect(_emphasisedSso, findsOneWidget);
      expect(_plainSso, findsNothing);
      // No banner without a reason.
      expect(find.byKey(const ValueKey('logout-reason')), findsNothing);
    });

    testWidgets('Google redirect ?error=SSO_REQUIRED → the same notice',
        (tester) async {
      final h = await _pump(tester);
      h.notifier.showSignInNotice('SSO_REQUIRED');
      await tester.pumpAndSettle();

      expect((h.auth as AuthUnauthenticated).reason, 'SSO_REQUIRED');
      expect(find.text(_l10n(tester).authErrSsoRequired), findsOneWidget);
      expect(_emphasisedSso, findsOneWidget);
    });

    testWidgets(
        'forced logout because "Require SSO" was switched on → /login with '
        'the SSO notice', (tester) async {
      final h = await _pump(tester,
          initial: const AuthAuthenticated(_member), location: '/');
      expect(find.text('home-page'), findsOneWidget);

      // What the refresh interceptor records for a revoked `sso_enforced`
      // session (see TokenManager.rejectionCodeOf below).
      TokenManager.shared.recordRejection('SSO_REQUIRED');
      h.notifier.forceLogout();
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();

      expect(h.router.routerDelegate.currentConfiguration.uri.path, '/login');
      expect((h.auth as AuthUnauthenticated).reason, 'SSO_REQUIRED');
      expect(find.text(_l10n(tester).authErrSsoRequired), findsOneWidget);
      expect(_emphasisedSso, findsOneWidget);
    });
  });

  testWidgets(
      'forgot-password refused with SSO_REQUIRED → back to sign-in with the '
      'SSO notice', (tester) async {
    final repo = _FakeRepo()
      ..forgotError =
          _codeError(403, 'SSO_REQUIRED', path: '/auth/forgot-password');
    final h = await _pump(tester, repo: repo, location: '/forgot-password');
    final l10n = _l10n(tester);

    await tester.enterText(find.byType(TextFormField).first, 'mia@acme.com');
    await tester.tap(find.text(l10n.sendOtpButton));
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();

    expect(h.router.routerDelegate.currentConfiguration.uri.path, '/login');
    expect(find.text(l10n.authErrSsoRequired), findsOneWidget);
    expect(_emphasisedSso, findsOneWidget);
    expect(find.text('otp-page'), findsNothing);
  });

  group('session revoked by "Require SSO"', () {
    test('rejection bodies map to SSO_REQUIRED', () {
      expect(
        TokenManager.rejectionCodeOf({
          'code': 'SESSION_REVOKED',
          'params': {'reason': 'sso_enforced'},
        }),
        'SSO_REQUIRED',
      );
      expect(
        TokenManager.rejectionCodeOf(
            {'code': 'SESSION_REVOKED', 'reason': 'sso_enforced'}),
        'SSO_REQUIRED',
      );
      expect(TokenManager.rejectionCodeOf({'code': 'SSO_REQUIRED'}),
          'SSO_REQUIRED');
      // Other revocations keep their own (non-explained) code.
      expect(
        TokenManager.rejectionCodeOf({
          'code': 'SESSION_REVOKED',
          'params': {'reason': 'role_changed'},
        }),
        'SESSION_REVOKED',
      );
      expect(TokenManager.rejectionCodeOf(null), isNull);
      expect(TokenManager.rejectionCodeOf('nope'), isNull);
    });

    test('a refresh rejected for sso_enforced records SSO_REQUIRED', () async {
      final storage = _MockStorage();
      final dio = _MockDio();
      final tm = TokenManager(storage, refreshDio: dio);
      when(() => storage.read(key: 'refreshToken'))
          .thenAnswer((_) async => 'v0.r');
      when(() => storage.read(key: 'sid')).thenAnswer((_) async => 'sid-1');
      final req = RequestOptions(path: '/auth/refresh');
      when(() => dio.post(any(), data: any(named: 'data'))).thenThrow(
        DioException(
          requestOptions: req,
          type: DioExceptionType.badResponse,
          response: Response(
            requestOptions: req,
            statusCode: 401,
            data: {
              'code': 'SESSION_REVOKED',
              'params': {'reason': 'sso_enforced'},
            },
          ),
        ),
      );

      await expectLater(
        tm.forceRefresh(),
        throwsA(isA<RefreshRejectedException>()
            .having((e) => e.code, 'code', 'SSO_REQUIRED')),
      );
      expect(tm.takeRejectionCode(), 'SSO_REQUIRED');
    });
  });

  test('SsoInfo parses enforced (only meaningful when enabled)', () {
    expect(
        SsoInfo.fromJson(const {'enabled': true, 'enforced': true}).enforced,
        isTrue);
    expect(SsoInfo.fromJson(const {'enabled': true}).enforced, isFalse);
    expect(
        SsoInfo.fromJson(const {'enabled': false, 'enforced': true}).enforced,
        isFalse);
    expect(SsoInfo.disabled.enforced, isFalse);
  });
}

class _MockStorage extends Mock implements FlutterSecureStorage {}

class _MockDio extends Mock implements Dio {}
