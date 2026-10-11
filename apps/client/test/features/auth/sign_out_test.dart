import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';

/// W10 parity: "Sign out" (the forced set-password screen calls
/// `AuthNotifier.logout`, see set_password_test) is a real logout — the
/// server session ends, the keychain is wiped and the realtime socket closes.

class _MockStorage extends Mock implements FlutterSecureStorage {}

class _MockDio extends Mock implements Dio {}

class _FakeRepo implements AuthRepository {
  int logoutCalls = 0;

  @override
  Future<void> logout() async => logoutCalls++;

  @override
  Future<String?> readAccessToken() async => 'access';

  @override
  Future<void> removeFcmToken(String token, {String? accessToken}) async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _RecordingStomp extends StompService {
  int resets = 0;

  @override
  void build() {}

  @override
  void resetSession() => resets++;
}

class _SignedIn extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(
      UserModel(id: 'u1', email: 'jane@acme.com', displayName: 'Jane'));
}

void main() {
  test('logout ends the server session, then wipes every stored credential',
      () async {
    final storage = _MockStorage();
    final dio = _MockDio();
    when(() => storage.read(key: 'sid')).thenAnswer((_) async => 'sid-1');
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((_) async {});
    when(() => dio.post<dynamic>('/auth/logout', data: any(named: 'data')))
        .thenAnswer((_) async =>
            Response(requestOptions: RequestOptions(path: '/auth/logout')));

    await AuthRepository(storage, dio).logout();

    verify(() => dio.post<dynamic>('/auth/logout', data: {'sid': 'sid-1'}))
        .called(1);
    for (final key in ['accessToken', 'refreshToken', 'sid', 'user']) {
      verify(() => storage.delete(key: key)).called(1);
    }
  });

  test('logout still wipes the keychain when the server is unreachable',
      () async {
    final storage = _MockStorage();
    final dio = _MockDio();
    when(() => storage.read(key: 'sid')).thenAnswer((_) async => 'sid-1');
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((_) async {});
    when(() => dio.post<dynamic>('/auth/logout', data: any(named: 'data')))
        .thenThrow(DioException(
            requestOptions: RequestOptions(path: '/auth/logout'),
            type: DioExceptionType.connectionError));

    await AuthRepository(storage, dio).logout();

    for (final key in ['accessToken', 'refreshToken', 'sid', 'user']) {
      verify(() => storage.delete(key: key)).called(1);
    }
  });

  test('signing out closes the realtime socket and forgets its subscriptions',
      () async {
    final repo = _FakeRepo();
    final stomp = _RecordingStomp();
    final container = ProviderContainer(overrides: [
      authRepositoryProvider.overrideWithValue(repo),
      authNotifierProvider.overrideWith(_SignedIn.new),
      stompServiceProvider.overrideWith(() => stomp),
    ]);
    addTearDown(container.dispose);
    await container.read(authNotifierProvider.future);

    await container.read(authNotifierProvider.notifier).logout();

    expect(repo.logoutCalls, 1);
    expect(stomp.resets, 1);
    expect(container.read(authNotifierProvider).valueOrNull,
        isA<AuthUnauthenticated>());
  });
}
