// Wiring of the media token into AuthNotifier: bootstrap on restore / login /
// MFA, bounded wait, clear on logout, restore race with a forced logout.

import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/media/media_token_holder.dart';
import 'package:platform_client/core/media/media_token_provider.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';

const _user = UserModel(id: 'u1', email: 'jane@acme.com', displayName: 'Jane');

const _challenge = MfaChallenge(
  mfaToken: 'tok',
  enrollmentRequired: false,
  userId: 'u1',
  email: 'jane@acme.com',
  displayName: 'Jane',
);

class _FakeRepo implements AuthRepository {
  UserModel? stored;

  @override
  Future<UserModel?> getStoredUser() async => stored;

  @override
  Future<SignInResult> login(String email, String password) async =>
      const SignInSuccess(_user);

  @override
  Future<MfaSignIn> mfaVerify(String mfaToken,
          {String? code, String? backupCode}) async =>
      const MfaSignIn(user: _user);

  @override
  Future<void> logout() async {}

  @override
  Future<void> clearCredentials() async {}

  @override
  Future<String?> readAccessToken() async => 'access';

  @override
  Future<void> removeFcmToken(String token, {String? accessToken}) async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _SilentStomp extends StompService {
  @override
  void build() {}

  @override
  void resetSession() {}
}

/// Records the lifecycle calls; `ensureBounded` waits on [gate] when set.
class _RecordingController extends MediaTokenController {
  _RecordingController() : super(fetch: () async => throw UnimplementedError());

  final events = <String>[];
  Completer<void>? gate;

  @override
  void activate() => events.add('activate');

  @override
  Future<void> ensureBounded([Duration wait = mediaTokenBootstrapWait]) async {
    events.add('ensureBounded');
    await gate?.future;
  }

  @override
  void clear() => events.add('clear');
}

/// Real login / MFA code paths on a notifier that starts signed out (the
/// default `build` would make riverpod complete its future twice on login).
class _SignedOut extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthUnauthenticated();
}

class _MfaPending extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthMfaPending(_challenge);
}

ProviderContainer _container(_FakeRepo repo, MediaTokenController media,
    {AuthNotifier Function()? notifier}) {
  final c = ProviderContainer(overrides: [
    if (notifier != null) authNotifierProvider.overrideWith(notifier),
    authRepositoryProvider.overrideWithValue(repo),
    mediaTokenControllerProvider.overrideWithValue(media),
    stompServiceProvider.overrideWith(_SilentStomp.new),
  ]);
  addTearDown(c.dispose);
  // authNotifierProvider is autoDispose: keep it (and its state) alive.
  c.listen(authNotifierProvider, (_, __) {});
  return c;
}

void main() {
  late _RecordingController media;
  late _FakeRepo repo;

  setUp(() {
    media = _RecordingController();
    repo = _FakeRepo();
    MediaTokenHolder.clear();
  });

  test('login_activates_and_awaits_media_token_before_authenticated',
      () async {
    final c = _container(repo, media, notifier: _SignedOut.new);
    await c.read(authNotifierProvider.future);
    media.gate = Completer<void>();

    final done = c.read(authNotifierProvider.notifier).login('a@b.c', 'pw');
    await Future<void>.delayed(Duration.zero);
    expect(media.events, ['activate', 'ensureBounded']);
    expect(c.read(authNotifierProvider).isLoading, isTrue);

    media.gate!.complete();
    await done;
    expect(c.read(authNotifierProvider).valueOrNull, isA<AuthAuthenticated>());
  });

  test('restore_activates_and_awaits_media_token_before_authenticated',
      () async {
    repo.stored = _user;
    media.gate = Completer<void>();
    final c = _container(repo, media);

    final future = c.read(authNotifierProvider.future);
    await Future<void>.delayed(Duration.zero);
    expect(media.events, ['activate', 'ensureBounded']);
    expect(c.read(authNotifierProvider).isLoading, isTrue);

    media.gate!.complete();
    expect(await future, isA<AuthAuthenticated>());
  });

  test('mfa_verify_activates_and_awaits_media_token_before_authenticated',
      () async {
    final c = _container(repo, media, notifier: _MfaPending.new);
    await c.read(authNotifierProvider.future);
    media.gate = Completer<void>();

    final done =
        c.read(authNotifierProvider.notifier).verifyMfa(code: '123456');
    await Future<void>.delayed(Duration.zero);
    expect(media.events, ['activate', 'ensureBounded']);
    expect(c.read(authNotifierProvider).valueOrNull, isA<AuthMfaPending>());

    media.gate!.complete();
    await done;
    expect(c.read(authNotifierProvider).valueOrNull, isA<AuthAuthenticated>());
  });

  test('hung_token_fetch_still_authenticates_within_5s', () {
    fakeAsync((async) {
      final real = MediaTokenController(
        fetch: () => Completer<({String token, DateTime expiresAt})>().future,
        now: () => async.getClock(DateTime(2026)).now(),
      );
      repo.stored = _user;
      final c = _container(repo, real);

      AuthState? result;
      c.read(authNotifierProvider.future).then((s) => result = s);
      async.elapse(const Duration(seconds: 4));
      expect(result, isNull);
      async.elapse(const Duration(seconds: 1));
      expect(result, isA<AuthAuthenticated>());
      real.clear();
    });
  });

  test('logout_clears_media_token', () async {
    repo.stored = _user;
    final c = _container(repo, media);
    await c.read(authNotifierProvider.future);
    media.events.clear();

    await c.read(authNotifierProvider.notifier).logout();
    expect(media.events, contains('clear'));
    expect(c.read(authNotifierProvider).valueOrNull,
        isA<AuthUnauthenticated>());
  });

  test('force_logout_clears_media_token', () async {
    repo.stored = _user;
    final c = _container(repo, media);
    await c.read(authNotifierProvider.future);
    media.events.clear();

    c.read(authNotifierProvider.notifier).forceLogout();
    expect(media.events, contains('clear'));
    expect(c.read(authNotifierProvider).valueOrNull,
        isA<AuthUnauthenticated>());
  });

  // Behavioral pin: a forceLogout during the restore token wait leaves the
  // notifier unauthenticated (Riverpod: a mid-build state write wins over
  // build()'s return). Guards against a Riverpod upgrade changing this.
  test('restore_returns_unauthenticated_if_session_cleared_during_token_wait',
      () async {
    repo.stored = _user;
    media.gate = Completer<void>();
    final c = _container(repo, media);

    final future = c.read(authNotifierProvider.future);
    await Future<void>.delayed(Duration.zero);
    // The token fetch's 401 -> refresh rejection ends the session.
    c.read(authNotifierProvider.notifier).forceLogout();
    media.gate!.complete();

    expect(await future, isA<AuthUnauthenticated>());
    expect(c.read(authNotifierProvider).valueOrNull,
        isA<AuthUnauthenticated>());
  });
}
