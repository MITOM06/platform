import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/widgets/pon_widgets.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/domain/chat_provider.dart';
import 'package:platform_client/features/settings/ui/widgets/regenerate_backup_codes_dialog.dart';
import 'package:platform_client/features/settings/ui/widgets/two_factor_section.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// An Owner / Admin-like member: 2FA required by the role (contract 15).
const _enrolled = UserModel(
  id: 'u1',
  email: 'o@acme.com',
  displayName: 'Olga',
  roleName: 'Admin',
  mfaRequired: true,
  mfaAvailable: true,
  mfaEnabled: true,
);

const _newCodes = [
  'AAAAA-BBBBB', 'CCCCC-DDDDD', 'EEEEE-FFFFF', 'GGGGG-HHHHH', 'IIIII-JJJJJ',
  'KKKKK-LLLLL', 'MMMMM-NNNNN', 'OOOOO-PPPPP', 'QQQQQ-RRRRR', 'SSSSS-TTTTT',
];

class _FakeRepo implements AuthRepository {
  _FakeRepo(this.me);
  UserModel me;
  Object? regenError;
  Object? getMeError;
  final regenCalls = <String>[];
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
  Future<List<String>> regenerateBackupCodes(String code) async {
    regenCalls.add(code);
    final error = regenError;
    if (error != null) throw error;
    return _newCodes;
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

Future<_FakeRepo> _pump(WidgetTester tester, UserModel user,
    {UserModel? me}) async {
  tester.view.physicalSize = const Size(1080, 2400);
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
  return repo;
}

AppLocalizations _l10n(WidgetTester tester) =>
    AppLocalizations.of(tester.element(find.byType(Scaffold)));

void main() {
  testWidgets('hidden when /me says 2FA is not available (SSO-enforced member)',
      (tester) async {
    const sso = UserModel(id: 'u2', email: 'm@acme.com', displayName: 'Mia');
    await _pump(tester, sso);
    expect(find.text(_l10n(tester).securityTwoFaTitle), findsNothing);
  });

  testWidgets('required by the role and on: status + regenerate, no turn off',
      (tester) async {
    await _pump(tester, _enrolled);
    final l10n = _l10n(tester);
    expect(find.text(l10n.securityTwoFaTitle), findsOneWidget);
    expect(find.text(l10n.securityMfaOn), findsOneWidget);
    expect(find.text(l10n.securityMfaStatusOn), findsOneWidget);
    expect(find.byKey(const ValueKey('security-mfa-regenerate')), findsOneWidget);
    expect(find.byKey(const ValueKey('security-mfa-turn-off')), findsNothing);
    expect(find.byKey(const ValueKey('security-mfa-turn-on')), findsNothing);
  });

  testWidgets('the required copy is role-based again (contract 15)',
      (tester) async {
    await _pump(tester,
        const UserModel(id: 'u4', email: 'x@acme.com', displayName: 'X'));
    final l10n = _l10n(tester);
    expect(l10n.securityMfaPending.toLowerCase(), contains('role'));
    expect(l10n.mfaEnrollSubtitle.toLowerCase(), contains('role'));
    expect(l10n.securityMfaPending.toLowerCase(), isNot(contains('organization')));
  });

  testWidgets('required but not enrolled: status only, no regenerate / turn on',
      (tester) async {
    const pending = UserModel(
      id: 'u1',
      email: 'o@acme.com',
      displayName: 'Olga',
      mfaRequired: true,
      mfaAvailable: true,
    );
    await _pump(tester, pending);
    final l10n = _l10n(tester);
    expect(find.text(l10n.securityMfaPending), findsOneWidget);
    expect(find.text(l10n.securityMfaStatusOff), findsOneWidget);
    expect(find.byKey(const ValueKey('security-mfa-regenerate')), findsNothing);
    expect(find.byKey(const ValueKey('security-mfa-turn-on')), findsNothing);
    expect(find.byKey(const ValueKey('security-mfa-turn-off')), findsNothing);
  });

  testWidgets('the /me re-sync reveals the section for a stale cache',
      (tester) async {
    const stale = UserModel(id: 'u1', email: 'o@acme.com', displayName: 'Olga');
    await _pump(tester, stale, me: _enrolled);
    expect(find.text(_l10n(tester).securityMfaOn), findsOneWidget);
  });

  testWidgets('regenerate: current code → new codes once, checkbox → Done',
      (tester) async {
    final repo = await _pump(tester, _enrolled);
    final l10n = _l10n(tester);
    expect(find.text(l10n.securityMfaStatusOn), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('security-mfa-regenerate')));
    await tester.pumpAndSettle();
    expect(find.text(l10n.securityMfaRegenerateHint), findsOneWidget);

    await tester.enterText(find.byKey(const ValueKey('regen-code')), '123456');
    await tester.pumpAndSettle();

    expect(repo.regenCalls, ['123456']);
    for (final c in _newCodes) {
      expect(find.text(c), findsOneWidget);
    }
    PonButton done() => tester
        .widget<PonButton>(find.byKey(const ValueKey('mfa-codes-continue')));
    expect(done().onPressed, isNull);

    await tester.tap(find.byKey(const ValueKey('mfa-saved-checkbox')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('mfa-codes-continue')));
    await tester.pumpAndSettle();
    expect(find.byType(RegenerateBackupCodesDialog), findsNothing);
  });

  testWidgets('regenerate with a wrong code shows a localized error',
      (tester) async {
    final repo = await _pump(tester, _enrolled);
    final req = RequestOptions(path: '/api/users/me/mfa/backup-codes');
    repo.regenError = DioException(
      requestOptions: req,
      type: DioExceptionType.badResponse,
      response: Response(
          requestOptions: req,
          statusCode: 401,
          data: const {'code': 'MFA_CODE_INVALID'}),
    );
    final l10n = _l10n(tester);

    await tester.tap(find.byKey(const ValueKey('security-mfa-regenerate')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('regen-code')), '000000');
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('regen-error')), findsOneWidget);
    expect(find.text(l10n.authErrMfaCodeInvalid), findsOneWidget);
    expect(find.textContaining('MFA_CODE_INVALID'), findsNothing);
    expect(find.byType(RegenerateBackupCodesDialog), findsOneWidget);
  });

  group('backup codes left', () {
    const left = ValueKey('security-mfa-backup-codes-left');
    const low = ValueKey('security-mfa-backup-codes-low');

    UserModel withCount(int? count, {bool enabled = true, bool required = true}) =>
        UserModel(
          id: 'u1',
          email: 'o@acme.com',
          displayName: 'Olga',
          mfaRequired: required,
          mfaAvailable: true,
          mfaEnabled: enabled,
          backupCodesRemaining: count,
        );

    Future<void> regenerate(WidgetTester tester) async {
      await tester.tap(find.byKey(const ValueKey('security-mfa-regenerate')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('regen-code')), '123456');
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('mfa-saved-checkbox')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('mfa-codes-continue')));
      await tester.pumpAndSettle();
    }

    for (final count in [10, 4]) {
      testWidgets('$count left: the count, no warning', (tester) async {
        await _pump(tester, withCount(count));
        final l10n = _l10n(tester);
        expect(find.text(l10n.securityMfaBackupCodesLeft(count)), findsOneWidget);
        expect(find.byKey(low), findsNothing);
      });
    }

    for (final count in [3, 1, 0]) {
      testWidgets('$count left: the count and a warning pointing at Regenerate',
          (tester) async {
        await _pump(tester, withCount(count));
        final l10n = _l10n(tester);
        expect(find.text(l10n.securityMfaBackupCodesLeft(count)), findsOneWidget);
        expect(find.byKey(low), findsOneWidget);
        final warning =
            l10n.securityMfaBackupCodesLow(l10n.securityMfaRegenerate);
        expect(find.text(warning), findsOneWidget);
        expect(warning, contains(l10n.securityMfaRegenerate));
        expect(
            find.byKey(const ValueKey('security-mfa-regenerate')), findsOneWidget);
      });
    }

    testWidgets('also for a Member who turned 2FA on', (tester) async {
      await _pump(tester, withCount(2, required: false));
      expect(find.byKey(left), findsOneWidget);
      expect(find.byKey(low), findsOneWidget);
      expect(find.byKey(const ValueKey('security-mfa-turn-off')), findsOneWidget);
    });

    testWidgets('an older server without the field: nothing, not 0',
        (tester) async {
      await _pump(tester, withCount(null));
      expect(find.byKey(left), findsNothing);
      expect(find.byKey(low), findsNothing);
      expect(find.byKey(const ValueKey('security-mfa-regenerate')), findsOneWidget);
    });

    testWidgets('2FA off: nothing, even with a count in the answer',
        (tester) async {
      await _pump(tester, withCount(0, enabled: false, required: false));
      expect(find.byKey(left), findsNothing);
      expect(find.byKey(low), findsNothing);
    });

    testWidgets('the /me re-sync on opening brings the current count',
        (tester) async {
      await _pump(tester, withCount(5), me: withCount(4));
      expect(find.text(_l10n(tester).securityMfaBackupCodesLeft(4)), findsOneWidget);
    });

    testWidgets('regenerating updates the count and clears the warning',
        (tester) async {
      final repo = await _pump(tester, withCount(2));
      expect(find.byKey(low), findsOneWidget);

      repo.me = withCount(10);
      await regenerate(tester);

      expect(find.text(_l10n(tester).securityMfaBackupCodesLeft(10)), findsOneWidget);
      expect(find.byKey(low), findsNothing);
    });

    testWidgets(
        'regenerating when only the /me refresh fails: the new count, cached, '
        'no stale warning', (tester) async {
      final repo = await _pump(tester, withCount(2));

      repo.getMeError = DioException(
        requestOptions: RequestOptions(path: '/api/users/me'),
        type: DioExceptionType.connectionError,
      );
      await regenerate(tester);

      expect(find.text(_l10n(tester).securityMfaBackupCodesLeft(10)), findsOneWidget);
      expect(find.byKey(low), findsNothing);
      expect(repo.cached.last.backupCodesRemaining, 10);
    });

    testWidgets('regenerating on an older server still shows no count',
        (tester) async {
      await _pump(tester, withCount(null));
      await regenerate(tester);
      expect(find.byKey(left), findsNothing);
    });

    test('every locale: the real number (French 0 too), no raw ICU', () async {
      for (final locale in AppLocalizations.supportedLocales) {
        final l10n = await AppLocalizations.delegate.load(locale);
        for (final count in [0, 1, 2, 3, 10]) {
          final text = l10n.securityMfaBackupCodesLeft(count);
          expect(text, contains('$count'), reason: '$locale $count');
          expect(text, isNot(matches(RegExp(r'[{}#]|plural'))));
        }
        final warning =
            l10n.securityMfaBackupCodesLow(l10n.securityMfaRegenerate);
        expect(warning, contains(l10n.securityMfaRegenerate),
            reason: '$locale warning');
        expect(warning, isNot(matches(RegExp(r'[{}]'))));
      }
    });
  });
}
