import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/router/route_guard.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/ui/set_password_screen.dart';
import 'package:platform_client/features/chat/domain/chat_provider.dart';
import 'package:platform_client/l10n/app_localizations.dart';

const _gatedUser = UserModel(
  id: 'u1',
  email: 'jane@acme.com',
  displayName: 'Jane',
  mustSetPassword: true,
);

const _readyUser = UserModel(
  id: 'u1',
  email: 'jane@acme.com',
  displayName: 'Jane',
  hasPassword: true,
);

const _validPassword = 'Secret#123';

/// In-memory stand-in for the auth-service calls the gate makes.
class _FakeRepo implements AuthRepository {
  final changeCalls = <(String?, String)>[];
  final cached = <UserModel>[];
  int logoutCalls = 0;
  Object? changeError;
  Object? meError;

  /// What `/me` answers: still gated until a password is accepted.
  UserModel meUser = _gatedUser;

  @override
  Future<void> changePassword(String? currentPassword, String newPassword) {
    changeCalls.add((currentPassword, newPassword));
    final error = changeError;
    if (error != null) return Future.error(error);
    meUser = _readyUser; // the server cleared the flag
    return Future.value();
  }

  @override
  Future<UserModel> getMe() {
    final error = meError;
    return error == null ? Future.value(meUser) : Future.error(error);
  }

  @override
  Future<void> cacheUser(UserModel user) async => cached.add(user);

  @override
  Future<void> logout() async => logoutCalls++;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Real [AuthNotifier] logic, minus the secure-storage session restore.
class _TestAuth extends AuthNotifier {
  _TestAuth(this._initial);
  final AuthState _initial;

  @override
  Future<AuthState> build() async => _initial;
}

DioException _codeError(int status, String code) {
  final req = RequestOptions(path: '/api/users/me/change-password');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(
        requestOptions: req, statusCode: status, data: {'code': code}),
  );
}

class _Harness {
  _Harness(this.container, this.router, this.repo);
  final ProviderContainer container;
  final GoRouter router;
  final _FakeRepo repo;

  AuthState? get auth => container.read(authNotifierProvider).valueOrNull;
}

/// Pumps a router wired like `app_router.dart` (same [redirectForAuthState],
/// refreshed on every auth change) with light placeholder pages.
Future<_Harness> _pump(
  WidgetTester tester, {
  UserModel user = _gatedUser,
  _FakeRepo? repo,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  final fake = repo ?? _FakeRepo();
  final container = ProviderContainer(overrides: [
    authRepositoryProvider.overrideWithValue(fake),
    authNotifierProvider.overrideWith(() => _TestAuth(AuthAuthenticated(user))),
    // `refreshUser` invalidates the cached profile; keep it network/timer-free.
    userProfileProvider.overrideWith((ref, id) async => _readyUser),
  ]);
  addTearDown(container.dispose);

  final refresh = ValueNotifier<int>(0);
  addTearDown(refresh.dispose);
  container.listen(authNotifierProvider, (_, __) => refresh.value++);

  final router = GoRouter(
    initialLocation: '/',
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
      GoRoute(path: '/settings', builder: (_, __) => const Text('settings')),
      GoRoute(path: '/login', builder: (_, __) => const Text('login-page')),
      GoRoute(
        path: kSetPasswordPath,
        builder: (_, __) => const SetPasswordScreen(),
      ),
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

Future<void> _fillAndSubmit(WidgetTester tester, String password) async {
  await tester.enterText(
      find.byKey(const ValueKey('set-password-new')), password);
  await tester.enterText(
      find.byKey(const ValueKey('set-password-confirm')), password);
  await tester.tap(find.byKey(const ValueKey('set-password-submit')));
  await tester.pumpAndSettle();
}

void main() {
  group('UserModel.mustSetPassword', () {
    test('parsed from the user payload, false when absent', () {
      expect(
        UserModel.fromJson(const {'id': 'u1', 'mustSetPassword': true})
            .mustSetPassword,
        isTrue,
      );
      expect(UserModel.fromJson(const {'id': 'u1'}).mustSetPassword, isFalse);
    });

    test('survives the persisted-session round trip', () {
      final restored = UserModel.fromJson(_gatedUser.toJson());
      expect(restored.mustSetPassword, isTrue);
    });

    test('withPasswordSet clears the gate and keeps the profile', () {
      final done = _gatedUser.withPasswordSet();
      expect(done.mustSetPassword, isFalse);
      expect(done.hasPassword, isTrue);
      expect(done.email, _gatedUser.email);
      expect(done.displayName, _gatedUser.displayName);
    });
  });

  testWidgets('a gated member is sent to /set-password and cannot leave it',
      (tester) async {
    final h = await _pump(tester);
    final l10n = _l10n(tester);

    expect(find.byType(SetPasswordScreen), findsOneWidget);
    expect(find.text(l10n.setPasswordTitle), findsOneWidget);
    expect(find.text(l10n.setPasswordSubtitle), findsOneWidget);
    // The account email it will sign in with, read-only (mirror of web).
    expect(find.text('jane@acme.com'), findsOneWidget);
    expect(find.text('home-page'), findsNothing);

    h.router.go('/settings');
    await tester.pumpAndSettle();
    expect(find.byType(SetPasswordScreen), findsOneWidget);
    expect(find.text('settings'), findsNothing);

    // No skip: no back/close affordance, nothing underneath to pop to.
    expect(find.byType(BackButton), findsNothing);
    expect(find.byType(CloseButton), findsNothing);
    expect(h.router.canPop(), isFalse);
  });

  testWidgets('a member without the flag never sees the screen',
      (tester) async {
    final h = await _pump(tester, user: _readyUser);
    expect(find.text('home-page'), findsOneWidget);

    h.router.go(kSetPasswordPath);
    await tester.pumpAndSettle();
    expect(find.byType(SetPasswordScreen), findsNothing);
    expect(find.text('home-page'), findsOneWidget);
  });

  testWidgets('a stale cached flag (password created elsewhere) clears on open',
      (tester) async {
    final repo = _FakeRepo()..meUser = _readyUser;
    final h = await _pump(tester, repo: repo);

    expect(find.byType(SetPasswordScreen), findsNothing);
    expect(find.text('home-page'), findsOneWidget);
    expect(h.repo.changeCalls, isEmpty);
  });

  testWidgets('a short password shows the localized length error',
      (tester) async {
    final h = await _pump(tester);
    final l10n = _l10n(tester);

    await _fillAndSubmit(tester, 'Ab1!');

    expect(find.text(l10n.valPasswordMin8), findsOneWidget);
    expect(h.repo.changeCalls, isEmpty);
    expect(find.byType(SetPasswordScreen), findsOneWidget);
  });

  testWidgets('a server VAL_PASSWORD_TOO_SHORT is localized, never raw',
      (tester) async {
    final repo = _FakeRepo()
      ..changeError = _codeError(400, 'VAL_PASSWORD_TOO_SHORT');
    final h = await _pump(tester, repo: repo);
    final l10n = _l10n(tester);

    await _fillAndSubmit(tester, _validPassword);

    expect(find.byKey(const ValueKey('set-password-error')), findsOneWidget);
    expect(find.text(l10n.authErrValPasswordTooShort), findsOneWidget);
    expect(find.textContaining('VAL_PASSWORD_TOO_SHORT'), findsNothing);
    expect(find.byType(SetPasswordScreen), findsOneWidget);
    expect((h.auth as AuthAuthenticated).user.mustSetPassword, isTrue);
  });

  testWidgets('CURRENT_PASSWORD_REQUIRED (already set elsewhere) re-syncs',
      (tester) async {
    final repo = _FakeRepo()
      ..changeError = _codeError(400, 'CURRENT_PASSWORD_REQUIRED');
    final h = await _pump(tester, repo: repo);
    expect(find.byType(SetPasswordScreen), findsOneWidget);

    repo.meUser = _readyUser; // the password now exists server-side
    await _fillAndSubmit(tester, _validPassword);

    expect(find.byType(SetPasswordScreen), findsNothing);
    expect(find.text('home-page'), findsOneWidget);
    expect(find.textContaining('CURRENT_PASSWORD_REQUIRED'), findsNothing);
    expect((h.auth as AuthAuthenticated).user.mustSetPassword, isFalse);
  });

  testWidgets('success sets the password, refreshes the user and moves on',
      (tester) async {
    final h = await _pump(tester);

    await _fillAndSubmit(tester, _validPassword);

    // First password: no current password is sent.
    expect(h.repo.changeCalls, [(null, _validPassword)]);
    expect(find.byType(SetPasswordScreen), findsNothing);
    expect(find.text('home-page'), findsOneWidget);
    expect((h.auth as AuthAuthenticated).user.mustSetPassword, isFalse);
  });

  testWidgets('a failed /me after success still clears the gate locally',
      (tester) async {
    final repo = _FakeRepo()
      ..meError = DioException(
        requestOptions: RequestOptions(path: '/api/users/me'),
        type: DioExceptionType.connectionError,
      );
    final h = await _pump(tester, repo: repo);

    await _fillAndSubmit(tester, _validPassword);

    expect(find.text('home-page'), findsOneWidget);
    final user = (h.auth as AuthAuthenticated).user;
    expect(user.mustSetPassword, isFalse);
    expect(user.hasPassword, isTrue);
    expect(h.repo.cached.single.mustSetPassword, isFalse);
  });

  testWidgets('signing out is the only other way off the screen',
      (tester) async {
    final h = await _pump(tester);

    await tester.tap(find.byKey(const ValueKey('set-password-sign-out')));
    await tester.pumpAndSettle();

    expect(h.repo.logoutCalls, 1);
    expect(find.text('login-page'), findsOneWidget);
    expect(find.byType(SetPasswordScreen), findsNothing);
  });
}
