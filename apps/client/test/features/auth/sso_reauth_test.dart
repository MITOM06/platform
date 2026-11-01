import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/data/sso_reauth_flag.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';
import 'package:platform_client/features/auth/ui/widgets/sso_sign_in_button.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Web parity (`lib/auth/sso-reauth.ts`): after the user signs out on this
/// device, the next "Sign in with SSO" asks the IdP to authenticate again
/// (`reauth=1`) instead of silently re-entering the previous person's account.

const _member = UserModel(id: 'u1', email: 'jane@acme.com', displayName: 'Jane');

class _MockStorage extends Mock implements FlutterSecureStorage {}

class _MockDio extends Mock implements Dio {}

class _FakeRepo implements AuthRepository {
  SignInResult signInResult = const SignInSuccess(_member);
  Object? exchangeError;
  Object? logoutError;

  @override
  Future<SignInResult> exchangeCode(String code) async {
    final error = exchangeError;
    if (error != null) throw error;
    return signInResult;
  }

  @override
  Future<SignInResult> login(String email, String password) async =>
      signInResult;

  @override
  Future<void> logout() async {
    final error = logoutError;
    if (error != null) throw error;
  }

  @override
  Future<void> clearCredentials() async {}

  @override
  Future<String?> readAccessToken() async => 'access';

  @override
  Future<void> removeFcmToken(String token, {String? accessToken}) async {}

  @override
  Future<void> updateFcmToken(String token) async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _SilentStomp extends StompService {
  @override
  void build() {}

  @override
  void resetSession() {}
}

class _TestAuth extends AuthNotifier {
  _TestAuth(this._initial);
  final AuthState _initial;

  @override
  Future<AuthState> build() async => _initial;
}

/// The real [AuthNotifier] and [SsoReauthFlag] on real (in-memory) preferences.
Future<ProviderContainer> _container(
  _FakeRepo repo, {
  bool flagAlreadySet = false,
  AuthState initial = const AuthAuthenticated(_member),
}) async {
  SharedPreferences.setMockInitialValues(
      flagAlreadySet ? {kSsoReauthPrefKey: true} : {});
  final prefs = await SharedPreferences.getInstance();
  final container = ProviderContainer(overrides: [
    sharedPreferencesProvider.overrideWithValue(prefs),
    authRepositoryProvider.overrideWithValue(repo),
    authNotifierProvider.overrideWith(() => _TestAuth(initial)),
    stompServiceProvider.overrideWith(_SilentStomp.new),
  ]);
  addTearDown(container.dispose);
  // Auto-dispose provider: the app always has a listener (the router), without
  // one it would be rebuilt as soon as a test yields to the event loop.
  container.listen(authNotifierProvider, (_, __) {});
  await container.read(authNotifierProvider.future);
  return container;
}

bool _isDue(ProviderContainer c) => c.read(ssoReauthFlagProvider).isDue;
AuthNotifier _auth(ProviderContainer c) => c.read(authNotifierProvider.notifier);

void main() {
  group('SsoReauthFlag', () {
    test('is off by default, on after mark, off again after clear', () async {
      final c = await _container(_FakeRepo());
      final flag = c.read(ssoReauthFlagProvider);

      expect(flag.isDue, isFalse);
      await flag.mark();
      expect(flag.isDue, isTrue);
      await flag.clear();
      expect(flag.isDue, isFalse);
    });

    test('survives closing the app (stored in preferences)', () async {
      final c = await _container(_FakeRepo());
      await c.read(ssoReauthFlagProvider).mark();

      final reopened = await SharedPreferences.getInstance();
      expect(reopened.getBool(kSsoReauthPrefKey), isTrue);
      expect(SsoReauthFlag(() => reopened).isDue, isTrue);
    });

    test('a storage failure never stops a sign-out or the SSO button',
        () async {
      final flag = SsoReauthFlag(() => throw StateError('no storage'));
      expect(flag.isDue, isFalse);
      await expectLater(flag.mark(), completes);
      await expectLater(flag.clear(), completes);
    });
  });

  group('sign-out', () {
    test('a user-initiated sign-out sets the flag', () async {
      final c = await _container(_FakeRepo());
      await _auth(c).logout();
      expect(_isDue(c), isTrue);
      expect(c.read(authNotifierProvider).valueOrNull,
          isA<AuthUnauthenticated>());
    });

    test('the flag is already set when the rest of the sign-out fails',
        () async {
      final repo = _FakeRepo()..logoutError = StateError('boom');
      final c = await _container(repo);
      await expectLater(_auth(c).logout(), throwsStateError);
      expect(_isDue(c), isTrue);
    });

    test('a forced logout (session died, nobody chose to leave) does not set it',
        () async {
      final c = await _container(_FakeRepo());
      _auth(c).forceLogout();
      await Future<void>.delayed(Duration.zero);
      expect(c.read(authNotifierProvider).valueOrNull,
          isA<AuthUnauthenticated>());
      expect(_isDue(c), isFalse);
    });

    test('a forced logout does not clear one that is already set', () async {
      final c = await _container(_FakeRepo(), flagAlreadySet: true);
      _auth(c).forceLogout();
      await Future<void>.delayed(Duration.zero);
      expect(_isDue(c), isTrue);
    });
  });

  group('signing back in', () {
    const signedOut = AuthUnauthenticated();

    test('a successful SSO sign-in clears the flag', () async {
      final repo = _FakeRepo()
        ..signInResult = const SignInSuccess(_member, viaSso: true);
      final c =
          await _container(repo, flagAlreadySet: true, initial: signedOut);
      await _auth(c).loginWithCode('sso-code');
      expect(c.read(authNotifierProvider).valueOrNull, isA<AuthAuthenticated>());
      expect(_isDue(c), isFalse);
    });

    // The IdP session may still be the previous person's: only the IdP having
    // just signed someone in makes a silent SSO safe again.
    test('a Google sign-in keeps it', () async {
      final c = await _container(_FakeRepo(),
          flagAlreadySet: true, initial: signedOut);
      await _auth(c).loginWithCode('google-code');
      expect(c.read(authNotifierProvider).valueOrNull, isA<AuthAuthenticated>());
      expect(_isDue(c), isTrue);
    });

    test('a Google sign-in stopping at the 2FA step keeps it', () async {
      final repo = _FakeRepo()
        ..signInResult = const SignInMfaRequired(MfaChallenge(
            mfaToken: 'mfa',
            enrollmentRequired: false,
            userId: 'u1',
            email: 'jane@acme.com',
            displayName: 'Jane'));
      final c =
          await _container(repo, flagAlreadySet: true, initial: signedOut);
      await _auth(c).loginWithCode('google-code');
      expect(c.read(authNotifierProvider).valueOrNull, isA<AuthMfaPending>());
      expect(_isDue(c), isTrue);
    });

    test('a password sign-in keeps it', () async {
      final c = await _container(_FakeRepo(),
          flagAlreadySet: true, initial: signedOut);
      await _auth(c).login('jane@acme.com', 'Secret#123');
      expect(c.read(authNotifierProvider).valueOrNull, isA<AuthAuthenticated>());
      expect(_isDue(c), isTrue);
    });

    test('a failed exchange keeps it', () async {
      final repo = _FakeRepo()..exchangeError = StateError('refused');
      final c =
          await _container(repo, flagAlreadySet: true, initial: signedOut);
      await _auth(c).loginWithCode('sso-code');
      expect(_isDue(c), isTrue);
    });

    test('an IdP that refused the sign-in keeps it', () async {
      final c = await _container(_FakeRepo(),
          flagAlreadySet: true, initial: signedOut);
      // main.dart: platform://auth?error=OIDC_EXCHANGE_FAILED.
      _auth(c).showSignInNotice('OIDC_EXCHANGE_FAILED');
      expect(_isDue(c), isTrue);
    });
  });

  group('AuthRepository.exchangeCode reads how the sign-in happened', () {
    Future<SignInResult> exchange(Map<String, dynamic> extra) {
      final storage = _MockStorage();
      final dio = _MockDio();
      when(() => storage.write(
          key: any(named: 'key'),
          value: any(named: 'value'))).thenAnswer((_) async {});
      when(() => dio.post<dynamic>('/auth/exchange', data: any(named: 'data')))
          .thenAnswer((_) async => Response(
                requestOptions: RequestOptions(path: '/auth/exchange'),
                data: <String, dynamic>{
                  'accessToken': 'a',
                  'refreshToken': 'r',
                  'sid': 's',
                  'user': {
                    'id': 'u1',
                    'email': 'jane@acme.com',
                    'displayName': 'Jane',
                  },
                  ...extra,
                },
              ));
      return AuthRepository(storage, dio).exchangeCode('code');
    }

    test('oidc is SSO', () async {
      final result = await exchange({'method': 'oidc'});
      expect((result as SignInSuccess).viaSso, isTrue);
    });

    test('google, or an older server that sends no method, is not', () async {
      for (final extra in [
        <String, dynamic>{'method': 'google'},
        <String, dynamic>{},
      ]) {
        final result = await exchange(extra);
        expect((result as SignInSuccess).viaSso, isFalse);
      }
    });
  });

  group('SsoSignInButton opens', () {
    const channel = MethodChannel('plugins.flutter.io/url_launcher');

    /// Taps the button and returns the URL handed to the browser.
    Future<Uri> tapAndCaptureUrl(
      WidgetTester tester, {
      required bool flagSet,
      required bool emphasised,
    }) async {
      final launched = <String>[];
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(channel, (call) async {
        launched.add((call.arguments as Map)['url'] as String);
        return true;
      });
      addTearDown(() => messenger.setMockMethodCallHandler(channel, null));

      SharedPreferences.setMockInitialValues(
          flagSet ? {kSsoReauthPrefKey: true} : {});
      final prefs = await SharedPreferences.getInstance();
      await tester.pumpWidget(ProviderScope(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('en'),
          home: Scaffold(body: SsoSignInButton(emphasised: emphasised)),
        ),
      ));

      await tester.tap(find.byKey(emphasised
          ? SsoSignInButton.emphasisedKey
          : SsoSignInButton.plainKey));
      await tester.pump();
      return Uri.parse(launched.single);
    }

    testWidgets('a plain link when nobody signed out here', (tester) async {
      final url =
          await tapAndCaptureUrl(tester, flagSet: false, emphasised: false);
      expect(url.path, endsWith('/auth/oidc/login'));
      expect(url.queryParameters, {'platform': 'mobile'});
    });

    testWidgets('reauth=1 after a sign-out on this device', (tester) async {
      final url =
          await tapAndCaptureUrl(tester, flagSet: true, emphasised: false);
      expect(url.queryParameters, {'platform': 'mobile', 'reauth': '1'});
    });

    testWidgets('the emphasised button (Require SSO, invite) behaves the same',
        (tester) async {
      final url =
          await tapAndCaptureUrl(tester, flagSet: true, emphasised: true);
      expect(url.queryParameters, {'platform': 'mobile', 'reauth': '1'});
    });
  });
}
