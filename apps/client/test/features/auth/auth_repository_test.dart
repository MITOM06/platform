import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/mfa_models.dart';
import 'package:platform_client/features/auth/domain/sso_info.dart';
import 'package:platform_client/features/auth/utils/auth_error.dart';

import '../integrations/route_adapter.dart';

const _storage = FlutterSecureStorage();

Map<String, dynamic> _session({String method = 'password'}) => {
      'accessToken': 'AT',
      'refreshToken': 'RT',
      'sid': 'S1',
      'method': method,
      'user': {'_id': 'u1', 'email': 'mia@acme.com', 'displayName': 'Mia'},
    };

Future<Map<String, String>> _stored() => _storage.readAll();

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late RouteAdapter adapter;
  late AuthRepository repo;

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({'other.secret': 'keep'});
    adapter = RouteAdapter();
    repo = AuthRepository(_storage, dioWith(adapter));
  });

  group('login', () {
    test('success persists tokens + user and reports viaSso=false', () async {
      adapter.routes['POST /auth/login'] = Reply(200, _session());
      final result = await repo.login('mia@acme.com', 'pw');
      expect(adapter.requests.single.data,
          {'email': 'mia@acme.com', 'password': 'pw'});
      expect(result, isA<SignInSuccess>());
      expect((result as SignInSuccess).user.id, 'u1');
      expect(result.viaSso, isFalse);
      final s = await _stored();
      expect(s['accessToken'], 'AT');
      expect(s['refreshToken'], 'RT');
      expect(s['sid'], 'S1');
      expect(jsonDecode(s['user']!)['email'], 'mia@acme.com');
      expect((await repo.getStoredUser())!.displayName, 'Mia');
      expect(await repo.readAccessToken(), 'AT');
    });

    test('MFA_REQUIRED returns the challenge and persists NOTHING', () async {
      adapter.routes['POST /auth/login'] = const Reply(200, {
        'code': 'MFA_REQUIRED',
        'mfaToken': 'mt',
        'enrolled': true,
      });
      final result = await repo.login('a@b.c', 'pw');
      expect(result, isA<SignInMfaRequired>());
      expect(await repo.readAccessToken(), isNull);
      expect(await repo.getStoredUser(), isNull);
    });

    test('wrong password → DioException mapped to the specific code', () async {
      adapter.routes['POST /auth/login'] =
          const Reply(401, {'code': 'INVALID_CREDENTIALS'});
      try {
        await repo.login('a@b.c', 'bad');
        fail('should throw');
      } on DioException catch (e) {
        expect(authErrorCode(e), 'INVALID_CREDENTIALS');
      }
      expect(await repo.readAccessToken(), isNull);
    });

    test('SSO_REQUIRED (403) is surfaced as its code, nothing persisted',
        () async {
      adapter.routes['POST /auth/login'] =
          const Reply(403, {'code': kSsoRequired});
      Object? err;
      try {
        await repo.login('a@sso.com', 'pw');
      } catch (e) {
        err = e;
      }
      expect(authErrorCode(err!), kSsoRequired);
      expect(await _stored(), {'other.secret': 'keep'});
    });

    test('exchangeCode via OIDC flags viaSso and sends platform=mobile',
        () async {
      adapter.routes['POST /auth/exchange'] = Reply(200, _session(method: 'oidc'));
      final r = await repo.exchangeCode('code-1') as SignInSuccess;
      expect(r.viaSso, isTrue);
      expect(adapter.requests.single.data, {'code': 'code-1', 'platform': 'mobile'});
    });
  });

  group('2FA', () {
    test('enroll start/confirm/complete at sign-in', () async {
      adapter.routes
        ..['POST /auth/mfa/enroll/start'] = const Reply(200, {
          'otpauthUrl': 'otpauth://totp/x?secret=S',
          'secret': 'S',
        })
        ..['POST /auth/mfa/enroll/confirm'] = const Reply(200, {
          'backupCodes': ['A', 'B'],
        })
        ..['POST /auth/mfa/enroll/complete'] = Reply(200, _session());
      final e = await repo.mfaEnrollStart('mt');
      expect(e.secret, 'S');
      expect(await repo.mfaEnrollConfirm('mt', '123456'), ['A', 'B']);
      // Confirm alone must not create a session.
      expect(await repo.readAccessToken(), isNull);
      final user = await repo.mfaEnrollComplete('mt');
      expect(user.id, 'u1');
      expect(await repo.readAccessToken(), 'AT');
      expect(adapter.requests.last.data, {'mfaToken': 'mt', 'platform': 'mobile'});
    });

    test('verify with a TOTP code sends only `code`', () async {
      adapter.routes['POST /auth/mfa/verify'] =
          Reply(200, {..._session(), 'backupCodesRemaining': 7});
      final r = await repo.mfaVerify('mt', code: '111222');
      expect(adapter.requests.single.data,
          {'mfaToken': 'mt', 'code': '111222', 'platform': 'mobile'});
      expect(r.backupCodesRemaining, 7);
      expect(r.user.id, 'u1');
      expect(await repo.readAccessToken(), 'AT');
    });

    test('verify with a backup code sends only `backupCode`', () async {
      adapter.routes['POST /auth/mfa/verify'] = Reply(200, _session());
      final r = await repo.mfaVerify('mt', backupCode: 'AAAAA-BBBBB');
      expect(adapter.requests.single.data,
          {'mfaToken': 'mt', 'backupCode': 'AAAAA-BBBBB', 'platform': 'mobile'});
      expect(r.backupCodesRemaining, isNull);
    });

    test('a wrong second-factor code stores nothing', () async {
      adapter.routes['POST /auth/mfa/verify'] = const Reply(401, {
        'code': 'MFA_CODE_INVALID',
        'params': {'remaining': 3}
      });
      await expectLater(repo.mfaVerify('mt', code: '000000'),
          throwsA(isA<DioException>()));
      expect(await repo.readAccessToken(), isNull);
    });

    test('regenerate backup codes; missing list → []', () async {
      adapter.routes['POST /api/users/me/mfa/backup-codes'] = const Reply(200, {});
      expect(await repo.regenerateBackupCodes('123456'), isEmpty);
      expect(adapter.requests.single.data, {'code': '123456'});
    });
  });

  group('logout / session', () {
    Future<void> signIn() async {
      adapter.routes['POST /auth/login'] = Reply(200, _session());
      await repo.login('a@b.c', 'pw');
    }

    test('logout revokes the sid then removes ONLY the session keys', () async {
      await signIn();
      adapter.routes['POST /auth/logout'] = const Reply(200, {});
      await repo.logout();
      expect(adapter.calls('POST', '/auth/logout').single.data, {'sid': 'S1'});
      expect(await _stored(), {'other.secret': 'keep'});
      expect(await repo.getStoredUser(), isNull);
    });

    test('logout still clears local credentials when the server call fails',
        () async {
      await signIn();
      adapter.routes['POST /auth/logout'] = const Reply(500, {});
      await repo.logout();
      expect(await repo.readAccessToken(), isNull);
      expect(await _stored(), {'other.secret': 'keep'});
    });

    test('logout without a sid makes no network call', () async {
      await repo.logout();
      expect(adapter.requests, isEmpty);
    });

    test('getStoredUser: missing token or corrupt JSON → null', () async {
      FlutterSecureStorage.setMockInitialValues({'user': '{"_id":"u1"}'});
      expect(await repo.getStoredUser(), isNull);
      FlutterSecureStorage.setMockInitialValues(
          {'accessToken': 'AT', 'user': 'not json'});
      expect(await repo.getStoredUser(), isNull);
    });

    test('getMe refreshes the cached user only while a session exists',
        () async {
      adapter.routes['GET /api/users/me'] = const Reply(200, {
        '_id': 'u1',
        'email': 'mia@acme.com',
        'displayName': 'Mia 2',
        'mustSetPassword': true,
      });
      // Signed out: getMe must not resurrect a session user.
      await repo.getMe();
      expect((await _stored()).containsKey('user'), isFalse);

      await signIn();
      final me = await repo.getMe();
      expect(me.mustSetPassword, isTrue);
      expect((await repo.getStoredUser())!.displayName, 'Mia 2');
    });
  });

  group('other endpoints', () {
    test('invitation token is URL-encoded in preview and accept', () async {
      adapter.routes
        ..['GET /auth/invitations/a%2Fb%3F'] = const Reply(200, {
          'email': 'n@acme.com',
          'workspaceName': 'Acme',
        })
        ..['POST /auth/invitations/a%2Fb%3F/accept-password'] =
            Reply(200, _session());
      await repo.getInvitation('a/b?');
      final r = await repo.acceptInvitationWithPassword('a/b?', 'New', 'pw');
      expect(r, isA<SignInSuccess>());
      expect(adapter.requests.last.data,
          {'displayName': 'New', 'password': 'pw', 'platform': 'mobile'});
    });

    test('expired invitation surfaces as an error code', () async {
      adapter.routes['GET /auth/invitations/t'] =
          const Reply(410, {'code': 'INVITATION_EXPIRED'});
      Object? err;
      try {
        await repo.getInvitation('t');
      } catch (e) {
        err = e;
      }
      expect(authErrorCode(err!), 'INVITATION_EXPIRED');
    });

    test('OTP / password reset payloads', () async {
      for (final p in [
        '/auth/verify-otp',
        '/auth/resend-otp',
        '/auth/forgot-password',
        '/auth/reset-password',
        '/api/users/me/change-password',
      ]) {
        adapter.routes['POST $p'] = const Reply(200, {});
      }
      await repo.verifyOtp('a@b.c', '123456');
      await repo.resendOtp('a@b.c');
      await repo.forgotPassword('a@b.c');
      await repo.resetPassword('a@b.c', '654321', 'newPw!');
      await repo.changePassword('', 'first');
      await repo.changePassword('old', 'next');
      expect(adapter.requests.map((r) => r.data).toList(), [
        {'email': 'a@b.c', 'otp': '123456'},
        {'email': 'a@b.c'},
        {'email': 'a@b.c'},
        {'email': 'a@b.c', 'otp': '654321', 'password': 'newPw!'},
        {'newPassword': 'first'},
        {'currentPassword': 'old', 'newPassword': 'next'},
      ]);
    });

    test('wrong OTP throws with its code', () async {
      adapter.routes['POST /auth/verify-otp'] =
          const Reply(400, {'code': 'OTP_INVALID'});
      Object? err;
      try {
        await repo.verifyOtp('a@b.c', '000000');
      } catch (e) {
        err = e;
      }
      expect(authErrorCode(err!), 'OTP_INVALID');
    });

    test('SSO info: success parses, any failure → disabled (fail-closed)',
        () async {
      adapter.routes['GET /auth/sso/info'] = const Reply(500, {});
      expect(await repo.getSsoInfo(), SsoInfo.disabled);
    });

    test('searchUsers sends q, tolerates a missing results list', () async {
      adapter.routes['GET /api/users/search'] = const Reply(200, {
        'results': [
          {'_id': 'u2', 'email': 'b@acme.com', 'matchedBy': 'phone'}
        ]
      });
      final r = await repo.searchUsers('0901');
      expect(adapter.requests.single.query, {'q': '0901'});
      expect(r.single.matchedBy, 'phone');
      expect(r.single.displayName, 'b@acme.com');

      adapter.routes['GET /api/users/search'] = const Reply(200, {});
      expect(await repo.searchUsers('x'), isEmpty);
    });

    test('updateProfile sends only given fields, DOB as UTC ISO', () async {
      adapter.routes['PATCH /api/users/me'] = const Reply(200, {
        '_id': 'u1',
        'email': 'a@b.c',
        'displayName': 'X',
      });
      await repo.updateProfile(
        displayName: 'X',
        dateOfBirth: DateTime.utc(2000, 1, 2),
        hideInfo: false,
        showPhoneNumber: true,
      );
      expect(adapter.requests.single.data, {
        'displayName': 'X',
        'dateOfBirth': '2000-01-02T00:00:00.000Z',
        'hideInfo': false,
        'showPhoneNumber': true,
      });
    });

    test('getUserProfile + phone verify', () async {
      adapter.routes
        ..['GET /api/users/u9'] =
            const Reply(200, {'_id': 'u9', 'isBlockedByOwner': true})
        ..['POST /api/users/me/phone/verify'] =
            const Reply(200, {'phoneNumber': '+84901'});
      expect((await repo.getUserProfile('u9')).isBlockedByOwner, isTrue);
      expect(await repo.verifyFirebasePhoneToken('idt'), '+84901');
      expect(adapter.requests.last.data, {'firebaseIdToken': 'idt'});
    });

    test('FCM token register is best-effort; remove without a token is a no-op',
        () async {
      adapter.routes['POST /api/users/device-tokens'] = const Reply(500, {});
      await repo.updateFcmToken('fcm-1'); // must not throw
      expect(adapter.requests.single.data, {'token': 'fcm-1'});
      await repo.removeFcmToken('fcm-1', accessToken: null);
      expect(adapter.requests, hasLength(1));
    });
  });
}
