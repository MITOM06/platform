// AuthNotifier.updateProfile commits the server's user only on success (no
// AsyncLoading flicker, failures leave the session intact), and the MFA steps
// refuse to run without a pending challenge / drop a dead one.

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';

class _Repo extends Mock implements AuthRepository {}

class _Auth extends AuthNotifier {
  _Auth(this.initial);
  final AuthState initial;
  @override
  Future<AuthState> build() async => initial;
}

const _me = UserModel(id: 'u1', email: 'a@x.io', displayName: 'Ann');

const _challenge = MfaChallenge(
  mfaToken: 'tok',
  enrollmentRequired: true,
  userId: 'u1',
  email: 'a@x.io',
  displayName: 'Ann',
);

DioException _code(String code, {int status = 401}) {
  final o = RequestOptions(path: '/x');
  return DioException(
      requestOptions: o,
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: status, data: {'code': code}));
}

void main() {
  late _Repo repo;

  Future<ProviderContainer> make(AuthState s) async {
    final c = ProviderContainer(overrides: [
      authRepositoryProvider.overrideWithValue(repo),
      authNotifierProvider.overrideWith(() => _Auth(s)),
    ]);
    addTearDown(c.dispose);
    await c.read(authNotifierProvider.future);
    return c;
  }

  setUp(() => repo = _Repo());

  test('updateProfile forwards every field and commits the returned user',
      () async {
    final dob = DateTime.utc(2000, 1, 2);
    when(() => repo.updateProfile(
          displayName: 'Annie',
          avatarUrl: 'a.png',
          bio: 'hi',
          coverPhoto: 'c.png',
          dateOfBirth: dob,
          phoneNumber: '+84',
          gender: 'female',
          hideInfo: true,
          showDateOfBirth: false,
          showPhoneNumber: true,
          showGender: false,
        )).thenAnswer((_) async =>
        const UserModel(id: 'u1', email: 'a@x.io', displayName: 'Annie'));
    final c = await make(const AuthAuthenticated(_me));
    final states = <AsyncValue<AuthState>>[];
    c.listen(authNotifierProvider, (_, n) => states.add(n));
    await c.read(authNotifierProvider.notifier).updateProfile(
          displayName: 'Annie',
          avatarUrl: 'a.png',
          bio: 'hi',
          coverPhoto: 'c.png',
          dateOfBirth: dob,
          phoneNumber: '+84',
          gender: 'female',
          hideInfo: true,
          showDateOfBirth: false,
          showPhoneNumber: true,
          showGender: false,
        );
    final s = c.read(authNotifierProvider).value as AuthAuthenticated;
    expect(s.user.displayName, 'Annie');
    // One transition, straight to the new user — never AsyncLoading.
    expect(states.length, 1);
    expect(states.single.isLoading, isFalse);
  });

  test('updateProfile failure rethrows and keeps the signed-in user',
      () async {
    when(() => repo.updateProfile(displayName: 'X'))
        .thenThrow(_code('VAL_DISPLAYNAME_TOO_SHORT', status: 400));
    final c = await make(const AuthAuthenticated(_me));
    await expectLater(
        c.read(authNotifierProvider.notifier).updateProfile(displayName: 'X'),
        throwsA(isA<DioException>()));
    final s = c.read(authNotifierProvider).value as AuthAuthenticated;
    expect(s.user.displayName, 'Ann');
  });

  test('MFA steps without a pending challenge throw StateError', () async {
    final c = await make(const AuthAuthenticated(_me));
    final n = c.read(authNotifierProvider.notifier);
    expect(() => n.verifyMfa(code: '123456'), throwsStateError);
    expect(() => n.startMfaEnrollment(), throwsStateError);
    verifyZeroInteractions(repo);
  });

  test('a dead challenge on enroll start drops back to login with the reason',
      () async {
    when(() => repo.mfaEnrollStart('tok'))
        .thenThrow(_code('MFA_TOKEN_INVALID'));
    final c = await make(const AuthMfaPending(_challenge));
    await expectLater(c.read(authNotifierProvider.notifier).startMfaEnrollment(),
        throwsA(isA<DioException>()));
    final s = c.read(authNotifierProvider).value;
    expect(s, isA<AuthUnauthenticated>());
    expect((s as AuthUnauthenticated).reason, 'MFA_TOKEN_INVALID');
  });

  test('a retryable enroll error keeps the challenge', () async {
    when(() => repo.mfaEnrollStart('tok')).thenThrow(DioException(
        requestOptions: RequestOptions(path: '/x'),
        type: DioExceptionType.connectionError));
    final c = await make(const AuthMfaPending(_challenge));
    await expectLater(c.read(authNotifierProvider.notifier).startMfaEnrollment(),
        throwsA(isA<DioException>()));
    expect(c.read(authNotifierProvider).value, isA<AuthMfaPending>());
  });
}
