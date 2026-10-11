import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/router/route_guard.dart';
import 'package:platform_client/core/widgets/pon_widgets.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/invitation_preview.dart';
import 'package:platform_client/features/auth/domain/invitation_preview_provider.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';
import 'package:platform_client/features/auth/domain/sso_info.dart';
import 'package:platform_client/features/auth/domain/sso_info_provider.dart';
import 'package:platform_client/features/auth/ui/accept_invite_screen.dart';
import 'package:platform_client/features/auth/ui/forgot_password_screen.dart';
import 'package:platform_client/features/auth/ui/login_screen.dart';
import 'package:platform_client/features/auth/utils/auth_error.dart';
import 'package:platform_client/features/profile/utils/phone_verify_error.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// QC 2026-10-11 auth fixes: specific messages for rate limits and network
/// failures on the auth screens (F12), phone verification (F13), two more
/// auth codes (F14), Google sign-in refused for SSO (F15) and hiding Google
/// when the deployment has it off (F23).

const _member =
    UserModel(id: 'u1', email: 'mia@acme.com', displayName: 'Mia');

DioException _status(int status, Object? body, {String path = '/x'}) {
  final req = RequestOptions(path: path);
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(requestOptions: req, statusCode: status, data: body),
  );
}

DioException _offline() => DioException(
    requestOptions: RequestOptions(path: '/auth/login'),
    type: DioExceptionType.connectionError);

class _FakeRepo implements AuthRepository {
  SsoInfo ssoInfo = SsoInfo.disabled;
  Object? loginError;
  Object? forgotError;
  Object? exchangeError;

  @override
  Future<SsoInfo> getSsoInfo() async => ssoInfo;

  @override
  Future<SignInResult> login(String email, String password) async {
    final error = loginError;
    if (error != null) throw error;
    return const SignInSuccess(_member);
  }

  @override
  Future<SignInResult> exchangeCode(String code) async {
    final error = exchangeError;
    if (error != null) throw error;
    return const SignInSuccess(_member);
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

class _TestAuth extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthUnauthenticated();
}

class _Harness {
  _Harness(this.container);
  final ProviderContainer container;
  AuthNotifier get notifier => container.read(authNotifierProvider.notifier);
  AsyncValue<AuthState> get auth => container.read(authNotifierProvider);
}

Future<_Harness> _pump(WidgetTester tester, _FakeRepo repo,
    {String location = '/login'}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  final container = ProviderContainer(overrides: [
    authRepositoryProvider.overrideWithValue(repo),
    authNotifierProvider.overrideWith(_TestAuth.new),
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
      return redirectForAuthState(auth.valueOrNull,
          path: state.uri.path, onboardingCompleted: true);
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const Text('home-page')),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(
          path: '/forgot-password',
          builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(path: '/verify-otp', builder: (_, __) => const Text('otp')),
      GoRoute(path: kMfaPath, builder: (_, __) => const Text('mfa')),
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
  await tester.pump(const Duration(seconds: 1));
  await tester.pumpAndSettle();
  return _Harness(container);
}

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));

String? _snackText(WidgetTester tester) {
  final snack = find.descendant(
      of: find.byType(SnackBar), matching: find.byType(Text));
  if (snack.evaluate().isEmpty) return null;
  return tester.widget<Text>(snack.first).data;
}

Future<void> _submitLogin(WidgetTester tester) async {
  await tester.enterText(find.byType(TextFormField).at(0), 'mia@acme.com');
  await tester.enterText(find.byType(TextFormField).at(1), 'Secret123!');
  await tester.tap(find.widgetWithText(PonButton, _l10n(tester).loginButton));
  await tester.pumpAndSettle();
}

void main() {
  group('auth screens name rate limits and network failures (F12)', () {
    testWidgets('login: a code-less 429 is "too many requests"',
        (tester) async {
      final repo = _FakeRepo()
        ..loginError = _status(429,
            {'statusCode': 429, 'message': 'ThrottlerException: Too Many Requests'},
            path: '/auth/login');
      await _pump(tester, repo);
      await _submitLogin(tester);
      expect(_snackText(tester), _l10n(tester).errTooManyRequests);
    });

    testWidgets('login: no response at all is a network error',
        (tester) async {
      final repo = _FakeRepo()..loginError = _offline();
      await _pump(tester, repo);
      await _submitLogin(tester);
      expect(_snackText(tester), _l10n(tester).errNetwork);
    });

    testWidgets('login: an auth code keeps its own message', (tester) async {
      final repo = _FakeRepo()
        ..loginError = _status(401, {
          'code': 'ACCOUNT_LOCKED',
          'params': {'minutes': 5}
        });
      await _pump(tester, repo);
      await _submitLogin(tester);
      expect(_snackText(tester), _l10n(tester).authErrAccountLocked(5));
    });

    testWidgets('forgot password: a code-less 429 is "too many requests"',
        (tester) async {
      final repo = _FakeRepo()
        ..forgotError =
            _status(429, {'statusCode': 429}, path: '/auth/forgot-password');
      await _pump(tester, repo, location: '/forgot-password');
      final l10n = _l10n(tester);
      await tester.enterText(find.byType(TextFormField).first, 'mia@acme.com');
      await tester.tap(find.text(l10n.sendOtpButton));
      await tester.pumpAndSettle();
      expect(_snackText(tester), l10n.errTooManyRequests);
    });
  });

  group('phone verification errors (F13)', () {
    final l10n = lookupAppLocalizations(const Locale('en'));

    test('a number already taken says so, not "wrong code"', () {
      expect(
          phoneVerifyErrorText(
              l10n, _status(400, {'code': 'PHONE_ALREADY_TAKEN'})),
          l10n.phoneAlreadyTaken);
    });

    test('a wrong or expired SMS code keeps its message', () {
      expect(
          phoneVerifyErrorText(l10n,
              FirebaseAuthException(code: 'invalid-verification-code')),
          l10n.phoneOtpInvalid);
      expect(
          phoneVerifyErrorText(
              l10n, FirebaseAuthException(code: 'session-expired')),
          l10n.phoneOtpExpired);
    });

    test('a network failure is a network error', () {
      expect(phoneVerifyErrorText(l10n, _offline()), l10n.errNetwork);
    });
  });

  testWidgets('TOO_MANY_OTP_REQUESTS and SOCIAL_PROVIDER_UNSUPPORTED (F14)',
      (tester) async {
    late BuildContext ctx;
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Builder(builder: (c) {
        ctx = c;
        return const SizedBox.shrink();
      }),
    ));
    final l10n = AppLocalizations.of(ctx);
    expect(authCodeToString(ctx, 'TOO_MANY_OTP_REQUESTS'),
        l10n.authErrTooManyOtpRequests);
    expect(authCodeToString(ctx, 'SOCIAL_PROVIDER_UNSUPPORTED'),
        l10n.authErrSocialProviderUnsupported);
    expect(
        authErrorMessage(
            ctx, _status(400, {'code': 'TOO_MANY_OTP_REQUESTS'})),
        l10n.authErrTooManyOtpRequests);
  });

  testWidgets(
      'Google sign-in refused with SSO_REQUIRED is the SSO notice, not an '
      'error (F15)', (tester) async {
    final repo = _FakeRepo()
      ..exchangeError =
          _status(403, {'code': 'SSO_REQUIRED'}, path: '/auth/exchange');
    final h = await _pump(tester, repo);

    await h.notifier.loginWithCode('one-time-code');
    await tester.pumpAndSettle();

    expect(h.auth.hasError, isFalse);
    final auth = h.auth.valueOrNull;
    expect(auth, isA<AuthUnauthenticated>());
    expect((auth as AuthUnauthenticated).reason, kSsoRequired);
    expect(find.byType(SnackBar), findsNothing);
    expect(find.text(_l10n(tester).authErrSsoRequired), findsOneWidget);
  });

  group('Google sign-in off on the server (F23)', () {
    test('googleEnabled is read, and absent means on', () {
      expect(SsoInfo.fromJson(const {'enabled': false}).googleEnabled, isTrue);
      expect(
          SsoInfo.fromJson(const {'enabled': false, 'googleEnabled': false})
              .googleEnabled,
          isFalse);
      expect(SsoInfo.disabled.googleEnabled, isTrue);
    });

    testWidgets('the login screen hides the Google button', (tester) async {
      final repo = _FakeRepo()
        ..ssoInfo = const SsoInfo(
            enabled: false, buttonLabel: 'SSO', googleEnabled: false);
      await _pump(tester, repo);
      final l10n = _l10n(tester);
      expect(find.text(l10n.loginWithGoogle), findsNothing);
      // Nothing to "continue with" either.
      expect(find.text(l10n.orContinueWith), findsNothing);
    });

    testWidgets('it stays when the server does not say', (tester) async {
      await _pump(tester, _FakeRepo());
      expect(find.text(_l10n(tester).loginWithGoogle), findsOneWidget);
    });

    testWidgets('the invitation offers no Google accept either',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      const token = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';
      await tester.pumpWidget(ProviderScope(
        overrides: [
          invitationPreviewProvider(token).overrideWith(
            (ref) async => const InvitationPreview(
              email: 'jane@acme.com',
              workspaceName: 'Acme',
              inviterName: 'Khang',
              roleName: 'Member',
            ),
          ),
          ssoInfoProvider.overrideWith((ref) async => const SsoInfo(
              enabled: false, buttonLabel: 'SSO', googleEnabled: false)),
        ],
        child: const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: Locale('en'),
          home: AcceptInviteScreen(token: token),
        ),
      ));
      await tester.pumpAndSettle();
      final l10n = AppLocalizations.of(
          tester.element(find.byType(AcceptInviteScreen)));
      expect(find.text(l10n.inviteContinueWithGoogle), findsNothing);
      expect(find.text(l10n.inviteSubmit), findsOneWidget);
    });
  });
}
