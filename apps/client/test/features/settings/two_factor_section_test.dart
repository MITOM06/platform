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

const _enrolled = UserModel(
  id: 'u1',
  email: 'o@acme.com',
  displayName: 'Olga',
  mfaRequired: true,
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
  final regenCalls = <String>[];

  @override
  Future<UserModel> getMe() async => me;

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
  testWidgets('not offered to members whose role does not require 2FA',
      (tester) async {
    const plain = UserModel(id: 'u2', email: 'm@acme.com', displayName: 'Mia');
    await _pump(tester, plain);
    expect(find.text(_l10n(tester).securityTwoFaTitle), findsNothing);
  });

  testWidgets('required but not enrolled: status only, no regenerate',
      (tester) async {
    const pending = UserModel(
        id: 'u1', email: 'o@acme.com', displayName: 'Olga', mfaRequired: true);
    await _pump(tester, pending);
    final l10n = _l10n(tester);
    expect(find.text(l10n.securityMfaPending), findsOneWidget);
    expect(find.text(l10n.securityMfaStatusOff), findsOneWidget);
    expect(find.byKey(const ValueKey('security-mfa-regenerate')), findsNothing);
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
}
