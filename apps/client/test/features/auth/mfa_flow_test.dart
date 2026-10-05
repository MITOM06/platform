import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/router/route_guard.dart';
import 'package:platform_client/core/widgets/pon_widgets.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';
import 'package:platform_client/features/auth/ui/mfa_screen.dart';
import 'package:platform_client/features/auth/ui/widgets/mfa_enroll_view.dart';
import 'package:platform_client/features/auth/ui/widgets/mfa_verify_view.dart';
import 'package:platform_client/features/chat/domain/chat_provider.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import 'mfa_test_data.dart';

const _owner = UserModel(id: 'u1', email: 'olga@acme.com', displayName: 'Olga');

/// Google-invited Admin: 2FA first, then the forced set-password step.
const _gatedOwner = UserModel(
  id: 'u1',
  email: 'olga@acme.com',
  displayName: 'Olga',
  mustSetPassword: true,
);

const _verifyChallenge = MfaChallenge(
  mfaToken: 'tok_verify',
  enrollmentRequired: false,
  userId: 'u1',
  email: 'olga@acme.com',
  displayName: 'Olga',
);

const _enrollChallenge = MfaChallenge(
  mfaToken: 'tok_enroll',
  enrollmentRequired: true,
  userId: 'u1',
  email: 'olga@acme.com',
  displayName: 'Olga',
);

const _codes = [
  'AAAAA-BBBBB', 'CCCCC-DDDDD', 'EEEEE-FFFFF', 'GGGGG-HHHHH', 'IIIII-JJJJJ',
  'KKKKK-LLLLL', 'MMMMM-NNNNN', 'OOOOO-PPPPP', 'QQQQQ-RRRRR', 'SSSSS-TTTTT',
];

/// In-memory stand-in for the auth-service sign-in + `/auth/mfa/*` calls.
class _FakeRepo implements AuthRepository {
  SignInResult loginResult = const SignInMfaRequired(_verifyChallenge);
  SignInResult exchangeResult = const SignInMfaRequired(_verifyChallenge);
  UserModel signedInUser = _owner;
  Object? verifyError;
  Object? confirmError;
  Object? completeError;
  int? backupCodesRemaining;

  /// Sessions the real repository would have persisted (verify / complete).
  int sessionsSaved = 0;

  final verifyCalls = <(String, String?, String?)>[];
  final confirmCalls = <(String, String)>[];
  final completeCalls = <String>[];
  final enrollStartCalls = <String>[];

  @override
  Future<SignInResult> login(String email, String password) async =>
      loginResult;

  @override
  Future<SignInResult> exchangeCode(String code) async => exchangeResult;

  @override
  Future<MfaSignIn> mfaVerify(String mfaToken,
      {String? code, String? backupCode}) async {
    verifyCalls.add((mfaToken, code, backupCode));
    final error = verifyError;
    if (error != null) throw error;
    sessionsSaved++;
    return MfaSignIn(
        user: signedInUser, backupCodesRemaining: backupCodesRemaining);
  }

  @override
  Future<MfaEnrollment> mfaEnrollStart(String mfaToken) async {
    enrollStartCalls.add(mfaToken);
    return const MfaEnrollment(
      otpauthUrl: 'otpauth://totp/PON:olga@acme.com?secret=JBSWY3DPEHPK3PXP',
      secret: 'JBSWY3DPEHPK3PXP',
      qrDataUrl: kTinyPngDataUrl,
    );
  }

  /// Contract 11: confirm enrolls and returns the codes, never a session.
  @override
  Future<List<String>> mfaEnrollConfirm(String mfaToken, String code) async {
    confirmCalls.add((mfaToken, code));
    final error = confirmError;
    if (error != null) throw error;
    return _codes;
  }

  @override
  Future<UserModel> mfaEnrollComplete(String mfaToken) async {
    completeCalls.add(mfaToken);
    final error = completeError;
    if (error != null) throw error;
    sessionsSaved++;
    return signedInUser;
  }

  @override
  Future<void> updateFcmToken(String token) async {}

  @override
  Future<void> clearCredentials() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Real [AuthNotifier] logic, minus secure-storage restore and FCM.
class _TestAuth extends AuthNotifier {
  _TestAuth(this._initial);
  final AuthState _initial;

  @override
  Future<AuthState> build() async => _initial;
}

DioException _mfaError(String code, {Map<String, dynamic>? params}) {
  final req = RequestOptions(path: '/auth/mfa/verify');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(
      requestOptions: req,
      statusCode: 401,
      data: {'code': code, if (params != null) 'params': params},
    ),
  );
}

class _Harness {
  _Harness(this.container, this.router, this.repo);
  final ProviderContainer container;
  final GoRouter router;
  final _FakeRepo repo;

  AuthState? get auth => container.read(authNotifierProvider).valueOrNull;
  AuthNotifier get notifier => container.read(authNotifierProvider.notifier);
}

/// A router wired like `app_router.dart` (same [redirectForAuthState],
/// refreshed on every auth change), with the real [MfaScreen] at `/mfa`.
Future<_Harness> _pump(
  WidgetTester tester, {
  AuthState initial = const AuthUnauthenticated(),
  _FakeRepo? repo,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  final fake = repo ?? _FakeRepo();
  final container = ProviderContainer(overrides: [
    authRepositoryProvider.overrideWithValue(fake),
    authNotifierProvider.overrideWith(() => _TestAuth(initial)),
    userProfileProvider.overrideWith((ref, id) async => _owner),
  ]);
  addTearDown(container.dispose);

  final refresh = ValueNotifier<int>(0);
  addTearDown(refresh.dispose);
  container.listen(authNotifierProvider, (_, __) => refresh.value++);

  final router = GoRouter(
    initialLocation: '/login',
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
          path: kSetPasswordPath,
          builder: (_, __) => const Text('set-password-page')),
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
    AppLocalizations.of(tester.element(find.byType(Navigator).first));

void main() {
  group('first factor → /mfa', () {
    testWidgets('password login answering MFA_REQUIRED opens /mfa',
        (tester) async {
      final h = await _pump(tester);
      expect(find.text('login-page'), findsOneWidget);

      await h.notifier.login('olga@acme.com', 'Secret#123');
      await tester.pumpAndSettle();

      expect(h.auth, isA<AuthMfaPending>());
      expect(find.byType(MfaVerifyView), findsOneWidget);
      expect(find.text(_l10n(tester).mfaVerifyTitle), findsOneWidget);
      expect(find.text('olga@acme.com'), findsOneWidget);
      expect(find.text('home-page'), findsNothing);
    });

    testWidgets('Google login-code exchange answering MFA_REQUIRED opens /mfa',
        (tester) async {
      final repo = _FakeRepo()
        ..exchangeResult = const SignInMfaRequired(_enrollChallenge);
      final h = await _pump(tester, repo: repo);

      await h.notifier.loginWithCode('google-code');
      await tester.pumpAndSettle();

      expect(find.byType(MfaEnrollView), findsOneWidget);
      expect(h.repo.enrollStartCalls, ['tok_enroll']);
    });

    testWidgets('a non-privileged login still signs straight in',
        (tester) async {
      final repo = _FakeRepo()..loginResult = const SignInSuccess(_owner);
      final h = await _pump(tester, repo: repo);

      await h.notifier.login('olga@acme.com', 'Secret#123');
      await tester.pumpAndSettle();

      expect(find.text('home-page'), findsOneWidget);
      expect(find.byType(MfaScreen), findsNothing);
    });

    testWidgets('/mfa is unreachable without a pending challenge',
        (tester) async {
      final h = await _pump(tester);
      h.router.go(kMfaPath);
      await tester.pumpAndSettle();
      expect(find.text('login-page'), findsOneWidget);
      expect(find.byType(MfaScreen), findsNothing);
    });
  });

  group('verify mode', () {
    testWidgets('6 digits auto-submit and sign in like a normal login',
        (tester) async {
      final h = await _pump(tester,
          initial: const AuthMfaPending(_verifyChallenge));

      await tester.enterText(find.byKey(const ValueKey('mfa-code')), '123456');
      await tester.pumpAndSettle();

      expect(h.repo.verifyCalls, [('tok_verify', '123456', null)]);
      expect(h.auth, isA<AuthAuthenticated>());
      expect(find.text('home-page'), findsOneWidget);
    });

    testWidgets('success keeps the set-password gate for a gated member',
        (tester) async {
      final repo = _FakeRepo()..signedInUser = _gatedOwner;
      await _pump(tester,
          initial: const AuthMfaPending(_verifyChallenge), repo: repo);

      await tester.enterText(find.byKey(const ValueKey('mfa-code')), '654321');
      await tester.pumpAndSettle();

      expect(find.text('set-password-page'), findsOneWidget);
      expect(find.text('home-page'), findsNothing);
    });

    testWidgets('backup code mode sends the canonical backup code',
        (tester) async {
      final repo = _FakeRepo()..backupCodesRemaining = 9;
      final h = await _pump(tester,
          initial: const AuthMfaPending(_verifyChallenge), repo: repo);
      final l10n = _l10n(tester);

      await tester.tap(find.byKey(const ValueKey('mfa-toggle-backup')));
      await tester.pumpAndSettle();
      expect(find.text(l10n.mfaBackupSubtitle), findsOneWidget);
      expect(find.byKey(const ValueKey('mfa-code')), findsNothing);

      await tester.enterText(
          find.byKey(const ValueKey('mfa-backup-code')), 'abcde-fghij');
      await tester.tap(find.byKey(const ValueKey('mfa-verify-submit')));
      await tester.pumpAndSettle();

      expect(h.repo.verifyCalls, [('tok_verify', null, 'ABCDE-FGHIJ')]);
      expect(find.text('home-page'), findsOneWidget);
    });

    testWidgets('a malformed backup code is rejected locally',
        (tester) async {
      final h = await _pump(tester,
          initial: const AuthMfaPending(_verifyChallenge));
      final l10n = _l10n(tester);

      await tester.tap(find.byKey(const ValueKey('mfa-toggle-backup')));
      await tester.pumpAndSettle();
      await tester.enterText(
          find.byKey(const ValueKey('mfa-backup-code')), 'ABC');
      await tester.tap(find.byKey(const ValueKey('mfa-verify-submit')));
      await tester.pumpAndSettle();

      expect(find.text(l10n.valMfaBackupCodeInvalid), findsOneWidget);
      expect(h.repo.verifyCalls, isEmpty);
    });

    testWidgets('a wrong code shows the localized attempts left',
        (tester) async {
      final repo = _FakeRepo()
        ..verifyError =
            _mfaError('MFA_CODE_INVALID', params: {'remaining': 3});
      final h = await _pump(tester,
          initial: const AuthMfaPending(_verifyChallenge), repo: repo);
      final l10n = _l10n(tester);

      await tester.enterText(find.byKey(const ValueKey('mfa-code')), '000000');
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('mfa-error')), findsOneWidget);
      expect(
          find.text(l10n.authErrMfaCodeInvalidRemaining(3)), findsOneWidget);
      expect(find.textContaining('MFA_CODE_INVALID'), findsNothing);
      // Still on the step, challenge intact, code cleared for a retry.
      expect(find.byType(MfaVerifyView), findsOneWidget);
      expect(h.auth, isA<AuthMfaPending>());
      final field = tester.widget<EditableText>(find.descendant(
          of: find.byKey(const ValueKey('mfa-code')),
          matching: find.byType(EditableText)));
      expect(field.controller.text, isEmpty);
    });

    for (final code in ['MFA_TOKEN_INVALID', 'MFA_TOO_MANY_ATTEMPTS']) {
      testWidgets('$code drops the challenge and returns to login',
          (tester) async {
        final repo = _FakeRepo()..verifyError = _mfaError(code);
        final h = await _pump(tester,
            initial: const AuthMfaPending(_verifyChallenge), repo: repo);

        await tester.enterText(
            find.byKey(const ValueKey('mfa-code')), '111111');
        await tester.pumpAndSettle();

        expect(find.text('login-page'), findsOneWidget);
        expect(find.byType(MfaScreen), findsNothing);
        final auth = h.auth;
        expect(auth, isA<AuthUnauthenticated>());
        // The login screen banner explains it (allow-listed notice).
        expect((auth as AuthUnauthenticated).reason, code);
        expect(kLoginNotices, contains(code));
      });
    }

    testWidgets('"Back to sign in" abandons the challenge', (tester) async {
      final h = await _pump(tester,
          initial: const AuthMfaPending(_verifyChallenge));

      await tester.tap(find.byKey(const ValueKey('mfa-back-to-sign-in')));
      await tester.pumpAndSettle();

      expect(find.text('login-page'), findsOneWidget);
      expect(h.auth, isA<AuthUnauthenticated>());
      expect((h.auth as AuthUnauthenticated).reason, isNull);
    });

    testWidgets('an unrelated reason-less force logout keeps the challenge',
        (tester) async {
      final h = await _pump(tester,
          initial: const AuthMfaPending(_verifyChallenge));
      h.notifier.forceLogout();
      await tester.pumpAndSettle();
      expect(h.auth, isA<AuthMfaPending>());
      expect(find.byType(MfaVerifyView), findsOneWidget);
    });
  });

  group('enroll mode', () {
    testWidgets('QR, key, code, then backup codes gated by the checkbox',
        (tester) async {
      final h = await _pump(tester,
          initial: const AuthMfaPending(_enrollChallenge));
      final l10n = _l10n(tester);

      expect(find.text(l10n.mfaEnrollTitle), findsOneWidget);
      expect(find.byKey(const ValueKey('mfa-qr')), findsOneWidget);
      expect(find.text('JBSW Y3DP EHPK 3PXP'), findsOneWidget);

      await tester.enterText(
          find.byKey(const ValueKey('mfa-enroll-code')), '246810');
      await tester.pumpAndSettle();

      expect(h.repo.confirmCalls, [('tok_enroll', '246810')]);
      // Contract 11: enrolled, but NO session yet — held on /mfa for the codes.
      expect(h.auth, isA<AuthMfaBackupCodes>());
      expect(h.repo.sessionsSaved, 0);
      expect(h.repo.completeCalls, isEmpty);
      expect(find.text(l10n.mfaBackupCodesTitle), findsOneWidget);
      for (final c in _codes) {
        expect(find.text(c), findsOneWidget);
      }
      expect(find.byKey(const ValueKey('mfa-back-to-sign-in')), findsNothing);

      // Continue is disabled until "I saved my backup codes" is ticked.
      PonButton cont() => tester
          .widget<PonButton>(find.byKey(const ValueKey('mfa-codes-continue')));
      expect(cont().onPressed, isNull);
      await tester.tap(find.byKey(const ValueKey('mfa-codes-continue')));
      await tester.pumpAndSettle();
      expect(find.text(l10n.mfaBackupCodesTitle), findsOneWidget);
      expect(h.auth, isA<AuthMfaBackupCodes>());
      expect(h.repo.completeCalls, isEmpty);

      await tester.tap(find.byKey(const ValueKey('mfa-saved-checkbox')));
      await tester.pumpAndSettle();
      expect(cont().onPressed, isNotNull);

      // Continue → enroll/complete → the session is saved only now.
      await tester.tap(find.byKey(const ValueKey('mfa-codes-continue')));
      await tester.pumpAndSettle();
      expect(h.repo.completeCalls, ['tok_enroll']);
      expect(h.repo.sessionsSaved, 1);
      expect(h.auth, isA<AuthAuthenticated>());
      expect(find.text('home-page'), findsOneWidget);
    });

    testWidgets('an unrelated force logout on the codes step keeps the codes',
        (tester) async {
      final h = await _pump(tester,
          initial: const AuthMfaBackupCodes(_enrollChallenge, _codes));
      h.notifier.forceLogout();
      await tester.pumpAndSettle();
      expect(h.auth, isA<AuthMfaBackupCodes>());
      expect(find.byKey(const ValueKey('mfa-backup-codes')), findsOneWidget);
    });

    testWidgets('an expired token at complete returns to login with the reason',
        (tester) async {
      final repo = _FakeRepo()..completeError = _mfaError('MFA_TOKEN_INVALID');
      final h = await _pump(tester,
          initial: const AuthMfaBackupCodes(_enrollChallenge, _codes),
          repo: repo);

      await tester.tap(find.byKey(const ValueKey('mfa-saved-checkbox')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('mfa-codes-continue')));
      await tester.pumpAndSettle();

      expect(h.repo.completeCalls, ['tok_enroll']);
      expect(h.repo.sessionsSaved, 0);
      expect(find.text('login-page'), findsOneWidget);
      final auth = h.auth;
      expect(auth, isA<AuthUnauthenticated>());
      expect((auth as AuthUnauthenticated).reason, 'MFA_TOKEN_INVALID');
    });

    testWidgets('a network failure at complete keeps the codes for a retry',
        (tester) async {
      final repo = _FakeRepo()
        ..completeError = DioException(
          requestOptions: RequestOptions(path: '/auth/mfa/enroll/complete'),
          type: DioExceptionType.connectionError,
        );
      final h = await _pump(tester,
          initial: const AuthMfaBackupCodes(_enrollChallenge, _codes),
          repo: repo);

      await tester.tap(find.byKey(const ValueKey('mfa-saved-checkbox')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('mfa-codes-continue')));
      await tester.pumpAndSettle();

      // Still on the codes, with a localized error (never the raw exception).
      expect(h.auth, isA<AuthMfaBackupCodes>());
      expect(find.byKey(const ValueKey('mfa-backup-codes')), findsOneWidget);
      expect(find.byKey(const ValueKey('mfa-error')), findsOneWidget);
      expect(find.textContaining('DioException'), findsNothing);
      expect(h.repo.sessionsSaved, 0);

      repo.completeError = null;
      await tester.tap(find.byKey(const ValueKey('mfa-codes-continue')));
      await tester.pumpAndSettle();
      expect(h.repo.completeCalls, ['tok_enroll', 'tok_enroll']);
      expect(h.repo.sessionsSaved, 1);
      expect(find.text('home-page'), findsOneWidget);
    });

    testWidgets('enroll then the set-password gate for a Google invitee',
        (tester) async {
      final repo = _FakeRepo()..signedInUser = _gatedOwner;
      await _pump(tester,
          initial: const AuthMfaPending(_enrollChallenge), repo: repo);

      await tester.enterText(
          find.byKey(const ValueKey('mfa-enroll-code')), '135790');
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('mfa-saved-checkbox')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('mfa-codes-continue')));
      await tester.pumpAndSettle();

      expect(find.text('set-password-page'), findsOneWidget);
    });

    testWidgets('a wrong first code stays on the step, localized',
        (tester) async {
      final repo = _FakeRepo()..confirmError = _mfaError('MFA_CODE_INVALID');
      final h = await _pump(tester,
          initial: const AuthMfaPending(_enrollChallenge), repo: repo);
      final l10n = _l10n(tester);

      await tester.enterText(
          find.byKey(const ValueKey('mfa-enroll-code')), '999999');
      await tester.pumpAndSettle();

      expect(find.text(l10n.authErrMfaCodeInvalid), findsOneWidget);
      expect(find.byType(MfaEnrollView), findsOneWidget);
      expect(h.auth, isA<AuthMfaPending>());
    });
  });
}
