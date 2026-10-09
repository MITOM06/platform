import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/router/route_guard.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/invitation_preview.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';
import 'package:platform_client/features/auth/ui/accept_invite_screen.dart';
import 'package:platform_client/features/auth/ui/mfa_screen.dart';
import 'package:platform_client/features/auth/ui/widgets/sso_sign_in_button.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import 'mfa_test_data.dart';

/// Contract 15 (was 13): accepting an Owner / Admin-like invitation with a
/// password starts a 2FA enrollment (`MFA_REQUIRED`) instead of signing in; a
/// Member invitation signs in directly. An email in an SSO-enforced domain is
/// told to use SSO.

const _token = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';

const _enrollChallenge = MfaChallenge(
  mfaToken: 'tok_invite',
  enrollmentRequired: true,
  userId: 'u9',
  email: 'jane@acme.com',
  displayName: 'Jane',
);

DioException _codeError(int status, String code) {
  final req = RequestOptions(path: '/auth/invitations/x/accept-password');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response:
        Response(requestOptions: req, statusCode: status, data: {'code': code}),
  );
}

class _FakeRepo implements AuthRepository {
  SignInResult acceptResult = const SignInMfaRequired(_enrollChallenge);
  Object? acceptError;
  final acceptCalls = <(String, String, String)>[];
  final enrollStartCalls = <String>[];

  @override
  Future<InvitationPreview> getInvitation(String token) async =>
      const InvitationPreview(
        email: 'jane@acme.com',
        workspaceName: 'Acme',
        inviterName: 'Khang',
        roleName: 'Member',
      );

  @override
  Future<SignInResult> acceptInvitationWithPassword(
      String token, String displayName, String password) async {
    acceptCalls.add((token, displayName, password));
    final error = acceptError;
    if (error != null) throw error;
    return acceptResult;
  }

  @override
  Future<MfaEnrollment> mfaEnrollStart(String mfaToken) async {
    enrollStartCalls.add(mfaToken);
    return const MfaEnrollment(
      otpauthUrl: 'otpauth://totp/PON:jane@acme.com?secret=JBSWY3DPEHPK3PXP',
      secret: 'JBSWY3DPEHPK3PXP',
      qrDataUrl: kTinyPngDataUrl,
    );
  }

  @override
  Future<void> updateFcmToken(String token) async {}

  @override
  Future<void> clearCredentials() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

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
  String get path => router.routerDelegate.currentConfiguration.uri.path;
}

Future<_Harness> _pump(
  WidgetTester tester, {
  AuthState initial = const AuthUnauthenticated(),
  _FakeRepo? repo,
}) async {
  tester.view.physicalSize = const Size(1080, 3000);
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
    initialLocation: '/invite/$_token',
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
      GoRoute(path: '/login', builder: (_, __) => const Text('login-page')),
      GoRoute(
        path: '/invite/:token',
        builder: (_, state) =>
            AcceptInviteScreen(token: state.pathParameters['token'] ?? ''),
      ),
      GoRoute(path: kMfaPath, builder: (_, __) => const MfaScreen()),
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
  await tester.pumpAndSettle();
  return _Harness(container, router, fake);
}

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold).first));

Future<void> _fillAndSubmit(WidgetTester tester) async {
  final l10n = _l10n(tester);
  await tester.tap(find.byType(Checkbox));
  await tester.enterText(
      find.widgetWithText(TextFormField, l10n.fieldDisplayName), 'Jane');
  await tester.enterText(
      find.widgetWithText(TextFormField, l10n.fieldPassword), 'Str0ng!Pass');
  await tester.enterText(
      find.widgetWithText(TextFormField, l10n.fieldConfirmPassword),
      'Str0ng!Pass');
  await tester.ensureVisible(find.text(l10n.inviteSubmit));
  await tester.tap(find.text(l10n.inviteSubmit));
  await tester.pumpAndSettle();
}

/// Answers `accept-password` with [body] and records the request.
class _AcceptAdapter implements HttpClientAdapter {
  _AcceptAdapter(this.body);
  final Map<String, dynamic> body;
  final requests = <(String, Map<String, dynamic>)>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(
        (options.path, Map<String, dynamic>.from(options.data as Map)));
    return ResponseBody.fromString(jsonEncode(body), 201, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AuthRepository.acceptInvitationWithPassword', () {
    Future<(SignInResult, Map<String, String>, _AcceptAdapter)> accept(
        Map<String, dynamic> body) async {
      FlutterSecureStorage.setMockInitialValues({});
      const storage = FlutterSecureStorage();
      final adapter = _AcceptAdapter(body);
      final repo =
          AuthRepository(storage, Dio()..httpClientAdapter = adapter);
      final result =
          await repo.acceptInvitationWithPassword('tok', 'Jane', 'Str0ng!Pass');
      return (result, await storage.readAll(), adapter);
    }

    test('privileged invite: MFA_REQUIRED → enrollment, nothing persisted',
        () async {
      final (result, stored, adapter) = await accept({
        'code': 'MFA_REQUIRED',
        'mfaToken': 'tok_invite',
        'enrollmentRequired': true,
        'user': {'id': 'u9', 'email': 'jane@acme.com', 'displayName': 'Jane'},
      });

      expect(result, isA<SignInMfaRequired>());
      final challenge = (result as SignInMfaRequired).challenge;
      expect(challenge.mfaToken, 'tok_invite');
      expect(challenge.enrollmentRequired, isTrue);
      expect(challenge.email, 'jane@acme.com');
      expect(stored, isEmpty, reason: 'no session before 2FA is set up');
      expect(adapter.requests.single.$1,
          '/auth/invitations/tok/accept-password');
      expect(adapter.requests.single.$2, {
        'displayName': 'Jane',
        'password': 'Str0ng!Pass',
        'platform': 'mobile',
      });
    });

    test('Member invite: the login-success body is persisted (no 2FA)',
        () async {
      final (result, stored, _) = await accept({
        'code': 'LOGIN_SUCCESS',
        'accessToken': 'a',
        'refreshToken': 'r',
        'sid': 's',
        'user': {'id': 'u9', 'email': 'jane@acme.com', 'displayName': 'Jane'},
      });
      expect(result, isA<SignInSuccess>());
      expect(stored['accessToken'], 'a');
      expect(stored['sid'], 's');
    });
  });

  testWidgets('privileged invite: password accept → /mfa in enroll mode',
      (tester) async {
    final h = await _pump(tester);
    await _fillAndSubmit(tester);

    expect(h.repo.acceptCalls, [(_token, 'Jane', 'Str0ng!Pass')]);
    expect(h.auth, isA<AuthMfaPending>());
    expect((h.auth as AuthMfaPending).challenge.enrollmentRequired, isTrue);
    expect(h.path, kMfaPath);
    expect(find.text(_l10n(tester).mfaEnrollTitle), findsOneWidget);
    expect(h.repo.enrollStartCalls, ['tok_invite']);
  });

  testWidgets('Member invite: password accept signs in directly → home',
      (tester) async {
    const member = UserModel(
      id: 'u9',
      email: 'jane@acme.com',
      displayName: 'Jane',
      roleName: 'Member',
    );
    final repo = _FakeRepo()..acceptResult = const SignInSuccess(member);
    final h = await _pump(tester, repo: repo);
    await _fillAndSubmit(tester);

    expect(h.repo.acceptCalls, [(_token, 'Jane', 'Str0ng!Pass')]);
    expect(h.auth, isA<AuthAuthenticated>());
    expect((h.auth as AuthAuthenticated).user.id, 'u9');
    expect(h.path, '/');
    expect(find.text('home-page'), findsOneWidget);
    expect(h.repo.enrollStartCalls, isEmpty, reason: 'no 2FA step');
  });

  testWidgets('password accept refused with SSO_REQUIRED → use-SSO notice',
      (tester) async {
    final repo = _FakeRepo()..acceptError = _codeError(403, 'SSO_REQUIRED');
    final h = await _pump(tester, repo: repo);
    final l10n = _l10n(tester);

    await _fillAndSubmit(tester);

    expect(h.path, '/invite/$_token');
    expect(find.byKey(const ValueKey('invite-sso-required')), findsOneWidget);
    expect(find.text(l10n.inviteSsoRequired), findsOneWidget);
    expect(find.byKey(SsoSignInButton.emphasisedKey), findsOneWidget);
    // The password / Google paths are gone; no raw code anywhere.
    expect(find.text(l10n.inviteSubmit), findsNothing);
    expect(find.text(l10n.inviteContinueWithGoogle), findsNothing);
    expect(find.byType(SnackBar), findsNothing);
    expect(find.textContaining('SSO_REQUIRED'), findsNothing);
  });

  testWidgets('Google accept refused with SSO_REQUIRED (deep link) → notice',
      (tester) async {
    final h = await _pump(tester);
    expect(find.byKey(const ValueKey('invite-sso-required')), findsNothing);

    // main.dart: platform://auth?error=SSO_REQUIRED → showSignInNotice.
    h.notifier.showSignInNotice('SSO_REQUIRED');
    await tester.pumpAndSettle();

    expect(h.path, '/invite/$_token');
    expect(find.text(_l10n(tester).inviteSsoRequired), findsOneWidget);
    expect(find.byKey(SsoSignInButton.emphasisedKey), findsOneWidget);
  });

  testWidgets('a stale SSO reason from an earlier session is not shown',
      (tester) async {
    await _pump(tester,
        initial: const AuthUnauthenticated(reason: 'SSO_REQUIRED'));
    expect(find.byKey(const ValueKey('invite-sso-required')), findsNothing);
    expect(find.text(_l10n(tester).inviteSubmit), findsOneWidget);
  });

  testWidgets('other accept errors stay a localized snackbar',
      (tester) async {
    final repo = _FakeRepo()
      ..acceptError = _codeError(410, 'INVITATION_EXPIRED');
    await _pump(tester, repo: repo);
    final l10n = _l10n(tester);

    await _fillAndSubmit(tester);

    expect(find.text(l10n.authErrInvitationExpired), findsOneWidget);
    expect(find.byKey(const ValueKey('invite-sso-required')), findsNothing);
  });
}
