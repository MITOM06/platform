import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/widgets/pon_widgets.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';
import 'package:platform_client/features/chat/domain/chat_provider.dart';
import 'package:platform_client/features/settings/domain/two_factor_settings_provider.dart';
import 'package:platform_client/features/settings/ui/widgets/turn_off_two_factor_dialog.dart';
import 'package:platform_client/features/settings/ui/widgets/two_factor_section.dart';
import 'package:platform_client/features/settings/utils/two_factor_error.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import '../auth/mfa_test_data.dart';

/// Contract 15: 2FA is optional for Members. Settings → Security lets them
/// turn it on (in place: QR / key → code → backup codes once) and off (current
/// code or a backup code); Owner / Admin-like roles keep it mandatory.

const _memberOff = UserModel(
  id: 'm1',
  email: 'mia@acme.com',
  displayName: 'Mia',
  roleName: 'Member',
  mfaAvailable: true,
);

const _memberOn = UserModel(
  id: 'm1',
  email: 'mia@acme.com',
  displayName: 'Mia',
  roleName: 'Member',
  mfaAvailable: true,
  mfaEnabled: true,
);

/// The same person after a promotion to Admin (2FA now required).
const _promoted = UserModel(
  id: 'm1',
  email: 'mia@acme.com',
  displayName: 'Mia',
  roleName: 'Admin',
  mfaAvailable: true,
  mfaRequired: true,
  mfaEnabled: true,
);

const _codes = [
  'AAAAA-BBBBB', 'CCCCC-DDDDD', 'EEEEE-FFFFF', 'GGGGG-HHHHH', 'IIIII-JJJJJ',
  'KKKKK-LLLLL', 'MMMMM-NNNNN', 'OOOOO-PPPPP', 'QQQQQ-RRRRR', 'SSSSS-TTTTT',
];

const _enrollment = MfaEnrollment(
  otpauthUrl: 'otpauth://totp/PON:mia@acme.com?secret=JBSWY3DPEHPK3PXP',
  secret: 'JBSWY3DPEHPK3PXP',
  qrDataUrl: kTinyPngDataUrl,
);

DioException _codeError(String code, {Map<String, dynamic>? params}) {
  final req = RequestOptions(path: '/api/users/me/mfa');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(
      requestOptions: req,
      statusCode: 400,
      data: {'code': code, if (params != null) 'params': params},
    ),
  );
}

DioException _networkError() => DioException(
      requestOptions: RequestOptions(path: '/api/users/me/mfa'),
      type: DioExceptionType.connectionError,
    );

class _FakeRepo implements AuthRepository {
  _FakeRepo(this.me);
  UserModel me;
  Object? getMeError;
  Object? startError;
  Object? confirmError;
  Object? disableError;
  int startCalls = 0;
  final confirmCalls = <String>[];
  final disableCalls = <(String?, String?)>[];
  final cached = <UserModel>[];

  @override
  Future<UserModel> getMe() async {
    final error = getMeError;
    if (error != null) throw error;
    return me;
  }

  @override
  Future<void> cacheUser(UserModel user) async => cached.add(user);

  @override
  Future<MfaEnrollment> selfMfaEnrollStart() async {
    startCalls++;
    final error = startError;
    if (error != null) throw error;
    return _enrollment;
  }

  @override
  Future<List<String>> selfMfaEnrollConfirm(String code) async {
    confirmCalls.add(code);
    final error = confirmError;
    if (error != null) throw error;
    return _codes;
  }

  @override
  Future<void> selfMfaDisable({String? code, String? backupCode}) async {
    disableCalls.add((code, backupCode));
    final error = disableError;
    if (error != null) throw error;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _TestAuth extends AuthNotifier {
  _TestAuth(this._user);
  final UserModel _user;

  @override
  Future<AuthState> build() async => AuthAuthenticated(_user);
}

class _Harness {
  _Harness(this.tester, this.repo);
  final WidgetTester tester;
  final _FakeRepo repo;

  AppLocalizations get l10n =>
      AppLocalizations.of(tester.element(find.byType(Scaffold).first));

  UserModel get user {
    final container = ProviderScope.containerOf(
        tester.element(find.byType(TwoFactorSection)));
    return (container.read(authNotifierProvider).valueOrNull
            as AuthAuthenticated)
        .user;
  }

  Future<void> tap(String key) async {
    final finder = find.byKey(ValueKey(key));
    await tester.ensureVisible(finder);
    await tester.pumpAndSettle();
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  Future<void> enter(String key, String text) async {
    final finder = find.byKey(ValueKey(key));
    await tester.ensureVisible(finder);
    await tester.enterText(finder, text);
    await tester.pumpAndSettle();
  }

  bool has(String key) =>
      find.byKey(ValueKey(key)).evaluate().isNotEmpty;

  void expectNoRawCodes() {
    expect(find.textContaining('MFA_'), findsNothing);
    expect(find.textContaining('SSO_'), findsNothing);
    expect(find.textContaining('DioException'), findsNothing);
  }
}

Future<_Harness> _pump(WidgetTester tester, UserModel user,
    {UserModel? me}) async {
  tester.view.physicalSize = const Size(1080, 4000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  final repo = _FakeRepo(me ?? user);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(repo),
      authNotifierProvider.overrideWith(() => _TestAuth(user)),
      userProfileProvider.overrideWith((ref, id) async => user),
    ],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: Locale('en'),
      home: Scaffold(body: SingleChildScrollView(child: TwoFactorSection())),
    ),
  ));
  await tester.pumpAndSettle();
  return _Harness(tester, repo);
}

void main() {
  group('section states', () {
    testWidgets('Member, off: explanation + Turn on, nothing else',
        (tester) async {
      final h = await _pump(tester, _memberOff);
      expect(find.text(h.l10n.securityMfaOptionalHint), findsOneWidget);
      expect(find.text(h.l10n.securityMfaStatusDisabled), findsOneWidget);
      expect(h.has('security-mfa-turn-on'), isTrue);
      expect(h.has('security-mfa-regenerate'), isFalse);
      expect(h.has('security-mfa-turn-off'), isFalse);
      expect(h.l10n.securityMfaOptionalHint.toLowerCase(), contains('optional'));
    });

    testWidgets('Member, on: status On + regenerate + Turn off',
        (tester) async {
      final h = await _pump(tester, _memberOn);
      expect(find.text(h.l10n.securityMfaOn), findsOneWidget);
      expect(find.text(h.l10n.securityMfaStatusOn), findsOneWidget);
      expect(h.has('security-mfa-regenerate'), isTrue);
      expect(h.has('security-mfa-turn-off'), isTrue);
      expect(h.has('security-mfa-turn-on'), isFalse);
    });

    testWidgets('not available (SSO-enforced, even if once enrolled): hidden',
        (tester) async {
      const sso = UserModel(
          id: 's1', email: 's@sso.acme.com', displayName: 'S', mfaEnabled: true);
      // `/me` is authoritative: an explicit `mfaAvailable: false`.
      final h = await _pump(tester, _memberOn, me: sso);
      expect(find.text(h.l10n.securityTwoFaTitle), findsNothing);
    });
  });

  group('turn on', () {
    testWidgets('QR + key → code → backup codes once → Done → On',
        (tester) async {
      final h = await _pump(tester, _memberOff);
      await h.tap('security-mfa-turn-on');

      expect(h.repo.startCalls, 1);
      expect(h.has('mfa-qr'), isTrue);
      expect(h.has('mfa-open-app'), isTrue);
      expect(find.text('JBSW Y3DP EHPK 3PXP'), findsOneWidget);
      expect(find.text(h.l10n.mfaEnrollStepCode), findsOneWidget);

      h.repo.me = _memberOn; // the server has 2FA on after the confirm
      await h.enter('security-mfa-setup-code', '123456');

      expect(h.repo.confirmCalls, ['123456']);
      expect(h.user.mfaEnabled, isTrue, reason: '/me re-synced at confirm');
      for (final c in _codes) {
        expect(find.text(c), findsOneWidget);
      }
      expect(h.has('security-mfa-turn-off'), isFalse,
          reason: 'the codes stay until Done');
      PonButton done() => tester
          .widget<PonButton>(find.byKey(const ValueKey('mfa-codes-continue')));
      expect(done().onPressed, isNull);

      await h.tap('mfa-saved-checkbox');
      await h.tap('mfa-codes-continue');

      expect(find.text(_codes.first), findsNothing);
      expect(find.text(h.l10n.securityMfaStatusOn), findsOneWidget);
      expect(h.has('security-mfa-turn-off'), isTrue);
      expect(h.has('security-mfa-regenerate'), isTrue);
      h.expectNoRawCodes();
    });

    testWidgets('a wrong code stays on the step with the attempts left',
        (tester) async {
      final h = await _pump(tester, _memberOff);
      h.repo.confirmError =
          _codeError('MFA_CODE_INVALID', params: {'remaining': 4});
      await h.tap('security-mfa-turn-on');
      await h.enter('security-mfa-setup-code', '000000');

      expect(find.text(h.l10n.authErrMfaCodeInvalidRemaining(4)),
          findsOneWidget);
      expect(h.has('security-mfa-setup'), isTrue);
      expect(h.user.mfaEnabled, isFalse);
      h.expectNoRawCodes();
    });

    testWidgets('too many wrong codes → back to the start, asked to wait',
        (tester) async {
      final h = await _pump(tester, _memberOff);
      h.repo.confirmError = _codeError('MFA_TOO_MANY_ATTEMPTS');
      await h.tap('security-mfa-turn-on');
      await h.enter('security-mfa-setup-code', '000000');

      expect(h.has('security-mfa-setup'), isFalse);
      expect(find.text(h.l10n.securityMfaTooManyAttempts), findsOneWidget);
      expect(find.text(h.l10n.authErrMfaTooManyAttempts), findsNothing,
          reason: 'no "sign in again" in Settings');
      expect(h.has('security-mfa-turn-on'), isTrue);
      h.expectNoRawCodes();
    });

    testWidgets('a timed-out setup → back to the start, asked to start again',
        (tester) async {
      final h = await _pump(tester, _memberOff);
      h.repo.confirmError = _codeError('MFA_TOKEN_INVALID');
      await h.tap('security-mfa-turn-on');
      await h.enter('security-mfa-setup-code', '123456');

      expect(h.has('security-mfa-setup'), isFalse);
      expect(find.text(h.l10n.securityMfaSetupExpired), findsOneWidget);

      // Starting again clears the reason and shows a fresh setup.
      h.repo.confirmError = null;
      await h.tap('security-mfa-turn-on');
      expect(h.repo.startCalls, 2);
      expect(h.has('security-mfa-setup'), isTrue);
      expect(find.text(h.l10n.securityMfaSetupExpired), findsNothing);
    });

    testWidgets('start fails offline → localized reason, Turn on stays',
        (tester) async {
      final h = await _pump(tester, _memberOff);
      h.repo.startError = _networkError();
      await h.tap('security-mfa-turn-on');

      expect(find.text(h.l10n.errNetwork), findsOneWidget);
      expect(h.has('security-mfa-turn-on'), isTrue);
      expect(h.has('security-mfa-setup'), isFalse);
      h.expectNoRawCodes();
    });

    testWidgets('already on elsewhere → /me re-synced, status On',
        (tester) async {
      final h = await _pump(tester, _memberOff);
      h.repo.startError = _codeError('MFA_ALREADY_ENROLLED');
      h.repo.me = _memberOn;
      await h.tap('security-mfa-turn-on');

      expect(h.user.mfaEnabled, isTrue);
      expect(h.has('security-mfa-turn-off'), isTrue);
      h.expectNoRawCodes();
    });

    testWidgets('Cancel returns to the status without confirming',
        (tester) async {
      final h = await _pump(tester, _memberOff);
      await h.tap('security-mfa-turn-on');
      await h.tap('security-mfa-setup-cancel');

      expect(h.has('security-mfa-setup'), isFalse);
      expect(h.has('security-mfa-turn-on'), isTrue);
      expect(h.repo.confirmCalls, isEmpty);
    });

    testWidgets('/me refresh fails after confirm → flag flipped locally',
        (tester) async {
      final h = await _pump(tester, _memberOff);
      await h.tap('security-mfa-turn-on');
      h.repo.getMeError = _networkError();
      await h.enter('security-mfa-setup-code', '123456');

      expect(h.user.mfaEnabled, isTrue);
      expect(h.repo.cached.single.mfaEnabled, isTrue);
      expect(find.text(_codes.first), findsOneWidget);
    });
  });

  group('turn off', () {
    testWidgets('current code → off, Turn on again', (tester) async {
      final h = await _pump(tester, _memberOn);
      await h.tap('security-mfa-turn-off');
      expect(find.byType(TurnOffTwoFactorDialog), findsOneWidget);
      expect(find.text(h.l10n.securityMfaTurnOffHint), findsOneWidget);

      h.repo.me = _memberOff;
      await h.enter('turn-off-code', '654321');

      expect(h.repo.disableCalls, [('654321', null)]);
      expect(find.byType(TurnOffTwoFactorDialog), findsNothing);
      expect(find.text(h.l10n.securityMfaStatusDisabled), findsOneWidget);
      expect(h.has('security-mfa-turn-on'), isTrue);
      expect(h.has('security-mfa-regenerate'), isFalse);
    });

    testWidgets('with a backup code instead', (tester) async {
      final h = await _pump(tester, _memberOn);
      await h.tap('security-mfa-turn-off');
      await h.tap('turn-off-toggle-backup');
      expect(find.text(h.l10n.mfaBackupSubtitle), findsOneWidget);

      h.repo.me = _memberOff;
      await h.enter('turn-off-backup-code', 'abcde-fghij');
      await h.tap('turn-off-submit');

      expect(h.repo.disableCalls, [(null, 'ABCDE-FGHIJ')]);
      expect(find.byType(TurnOffTwoFactorDialog), findsNothing);
      expect(h.has('security-mfa-turn-on'), isTrue);
    });

    testWidgets('a malformed backup code is caught before any request',
        (tester) async {
      final h = await _pump(tester, _memberOn);
      await h.tap('security-mfa-turn-off');
      await h.tap('turn-off-toggle-backup');
      await h.enter('turn-off-backup-code', 'ABC');
      await h.tap('turn-off-submit');

      expect(h.repo.disableCalls, isEmpty);
      expect(find.text(h.l10n.valMfaBackupCodeInvalid), findsWidgets);
    });

    testWidgets('a wrong code → localized reason, dialog stays',
        (tester) async {
      final h = await _pump(tester, _memberOn);
      h.repo.disableError =
          _codeError('MFA_CODE_INVALID', params: {'remaining': 2});
      await h.tap('security-mfa-turn-off');
      await h.enter('turn-off-code', '000000');

      expect(find.text(h.l10n.authErrMfaCodeInvalidRemaining(2)),
          findsOneWidget);
      expect(find.byType(TurnOffTwoFactorDialog), findsOneWidget);
      expect(h.user.mfaEnabled, isTrue);
      h.expectNoRawCodes();
    });

    testWidgets('MFA_REQUIRED_BY_ROLE (promoted meanwhile) → reason + re-sync',
        (tester) async {
      final h = await _pump(tester, _memberOn);
      h.repo.disableError = _codeError('MFA_REQUIRED_BY_ROLE');
      h.repo.me = _promoted;
      await h.tap('security-mfa-turn-off');
      await h.enter('turn-off-code', '123456');

      expect(find.byKey(const ValueKey('turn-off-error')), findsOneWidget);
      expect(find.text(h.l10n.authErrMfaRequiredByRole), findsOneWidget);
      h.expectNoRawCodes();

      await tester.tap(find.text(h.l10n.actionCancel));
      await tester.pumpAndSettle();
      expect(h.user.mfaRequired, isTrue);
      expect(h.has('security-mfa-turn-off'), isFalse);
      expect(h.has('security-mfa-regenerate'), isTrue);
    });
  });

  testWidgets('settings error wording', (tester) async {
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
    expect(twoFactorErrorMessage(ctx, const TwoFactorSetupExpired()),
        l10n.securityMfaSetupExpired);
    expect(twoFactorErrorMessage(ctx, _codeError('MFA_TOO_MANY_ATTEMPTS')),
        l10n.securityMfaTooManyAttempts);
    expect(twoFactorErrorMessage(ctx, _codeError('MFA_REQUIRED_BY_ROLE')),
        l10n.authErrMfaRequiredByRole);
    expect(twoFactorErrorMessage(ctx, _codeError('SSO_REQUIRED')),
        l10n.authErrSsoRequired);
    expect(twoFactorErrorMessage(ctx, _networkError()), l10n.errNetwork);
  });
}
