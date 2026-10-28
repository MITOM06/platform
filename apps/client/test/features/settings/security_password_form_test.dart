import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/domain/chat_provider.dart';
import 'package:platform_client/features/settings/ui/security_settings_screen.dart';
import 'package:platform_client/features/settings/utils/change_password_error.dart';
import 'package:platform_client/features/settings/utils/password_change_form.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// Settings → Security password form (mirror of web
/// `SecurityPasswordForm.test.tsx`): every problem shows under its input, the
/// first time on submit and then live as the user types.

const _user = UserModel(
  id: 'u1',
  email: 'alice@acme.com',
  displayName: 'Alice',
  hasPassword: true,
);

const _good = 'Secret#123';

DioException _codeError(String code) {
  final req = RequestOptions(path: '/api/users/me/change-password');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(
        requestOptions: req, statusCode: 400, data: {'code': code}),
  );
}

DioException _networkError() => DioException(
      requestOptions: RequestOptions(path: '/api/users/me/change-password'),
      type: DioExceptionType.connectionError,
    );

class _FakeRepo implements AuthRepository {
  Object? changeError;
  final changeCalls = <(String?, String)>[];

  @override
  Future<void> changePassword(String? currentPassword, String newPassword) async {
    changeCalls.add((currentPassword, newPassword));
    final error = changeError;
    if (error != null) throw error;
  }

  @override
  Future<UserModel> getMe() async => _user;

  @override
  Future<void> cacheUser(UserModel user) async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _TestAuth extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(_user);
}

class _Form {
  _Form(this.tester, this.repo);
  final WidgetTester tester;
  final _FakeRepo repo;

  AppLocalizations get l10n =>
      AppLocalizations.of(tester.element(find.byType(Scaffold).first));

  Future<void> enter(String key, String text) async {
    await tester.enterText(find.byKey(ValueKey('security-$key')), text);
    await tester.pumpAndSettle();
  }

  Future<void> submit() async {
    final button = find.byKey(const ValueKey('security-submit'));
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pumpAndSettle();
  }

  /// The error line drawn under one input, or `null`.
  String? errorOf(String key) {
    final field = find.byKey(ValueKey('security-$key'));
    final decorator = tester.widget<InputDecorator>(
        find.descendant(of: field, matching: find.byType(InputDecorator)));
    return decorator.decoration.errorText;
  }
}

Future<_Form> _pump(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1080, 4000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  final repo = _FakeRepo();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(repo),
      authNotifierProvider.overrideWith(_TestAuth.new),
      userProfileProvider.overrideWith((ref, id) async => _user),
    ],
    child: const MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: Locale('en'),
      home: SecuritySettingsScreen(),
    ),
  ));
  await tester.pumpAndSettle();
  return _Form(tester, repo);
}

void main() {
  group('validators', () {
    final l10n = lookupAppLocalizations(const Locale('en'));

    test('current: required', () {
      expect(currentPasswordError(l10n, ''), l10n.authErrCurrentPasswordRequired);
      expect(currentPasswordError(l10n, 'x'), isNull);
    });

    test('new: "enter a new password" first, then the policy', () {
      expect(newPasswordError(l10n, ''), l10n.valNewPasswordRequired);
      expect(newPasswordError(l10n, 'Ab#1'), l10n.valPasswordMin8);
      expect(newPasswordError(l10n, 'secret#123'), l10n.valPasswordUppercase);
      expect(newPasswordError(l10n, _good), isNull);
    });

    test('confirm: only judged once a new password was typed', () {
      expect(confirmPasswordError(l10n, '', ''), isNull);
      expect(confirmPasswordError(l10n, _good, ''), l10n.valPasswordMismatch);
      expect(confirmPasswordError(l10n, _good, _good), isNull);
    });

    test('server answers about one input belong to that input', () {
      expect(changePasswordErrorField(_codeError('CURRENT_PASSWORD_INCORRECT')),
          ChangePasswordField.current);
      expect(changePasswordErrorField(_codeError('CURRENT_PASSWORD_REQUIRED')),
          ChangePasswordField.current);
      expect(changePasswordErrorField(_codeError('VAL_PASSWORD_TOO_SHORT')),
          ChangePasswordField.next);
      expect(changePasswordErrorField(_networkError()), isNull);
    });
  });

  group('form', () {
    testWidgets('an empty submit marks each empty input and sends nothing',
        (tester) async {
      final form = await _pump(tester);
      await form.submit();

      expect(form.errorOf('current'), form.l10n.authErrCurrentPasswordRequired);
      expect(form.errorOf('new'), form.l10n.valNewPasswordRequired);
      expect(form.errorOf('confirm'), isNull);
      expect(form.repo.changeCalls, isEmpty);
    });

    testWidgets('after a submit, inputs are re-checked as the user types',
        (tester) async {
      final form = await _pump(tester);
      await form.enter('current', 'old-password');
      await form.submit();
      expect(form.errorOf('current'), isNull);

      await form.enter('new', 'secret#123');
      expect(form.errorOf('new'), form.l10n.valPasswordUppercase);
      await form.enter('new', _good);
      expect(form.errorOf('new'), isNull);
      expect(form.errorOf('confirm'), form.l10n.valPasswordMismatch);
      await form.enter('confirm', _good);
      expect(form.errorOf('confirm'), isNull);
    });

    testWidgets('a wrong current password shows under it until edited',
        (tester) async {
      final form = await _pump(tester);
      form.repo.changeError = _codeError('CURRENT_PASSWORD_INCORRECT');
      await form.enter('current', 'wrong-password');
      await form.enter('new', _good);
      await form.enter('confirm', _good);
      await form.submit();

      expect(form.repo.changeCalls, [('wrong-password', _good)]);
      expect(form.errorOf('current'), form.l10n.errCurrentPasswordIncorrect);

      await form.enter('current', 'wrong-password2');
      expect(form.errorOf('current'), isNull);
    });

    testWidgets('a network failure is a form-wide message', (tester) async {
      final form = await _pump(tester);
      form.repo.changeError = _networkError();
      await form.enter('current', 'old-password');
      await form.enter('new', _good);
      await form.enter('confirm', _good);
      await form.submit();

      expect(form.errorOf('current'), isNull);
      expect(find.textContaining('DioException'), findsNothing);
      expect(find.text(form.l10n.errNetwork), findsOneWidget);
    });

    testWidgets('after a successful change the form is empty, without errors',
        (tester) async {
      final form = await _pump(tester);
      await form.enter('current', 'old-password');
      await form.enter('new', _good);
      await form.enter('confirm', _good);
      await form.submit();
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();

      expect(form.repo.changeCalls, [('old-password', _good)]);
      final newField = tester.widget<TextField>(find.descendant(
          of: find.byKey(const ValueKey('security-new')),
          matching: find.byType(TextField)));
      expect(newField.controller?.text, isEmpty);
      expect(form.errorOf('current'), isNull);
      expect(form.errorOf('new'), isNull);
    });

    testWidgets('a success stays confirmed in the card until an input is edited',
        (tester) async {
      final form = await _pump(tester);
      await form.enter('current', 'old-password');
      await form.enter('new', _good);
      await form.enter('confirm', _good);
      await form.submit();

      final done = find.byKey(const ValueKey('security-done'));
      expect(done, findsOneWidget);
      expect(find.descendant(of: done, matching: find.text(form.l10n.passwordChangedSuccess)),
          findsOneWidget);
      expect(find.descendant(of: done, matching: find.text(form.l10n.securityChangeDoneBody)),
          findsOneWidget);

      await form.enter('current', 'o');
      expect(done, findsNothing);
    });
  });
}
