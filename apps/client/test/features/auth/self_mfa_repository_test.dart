import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';

import 'mfa_test_data.dart';

/// Contract 15: the signed-in member's own optional 2FA
/// (`/api/users/me/mfa/enroll/start|confirm`, `/api/users/me/mfa/disable`)
/// and the `mfaAvailable` flag of `/me`.

class _Adapter implements HttpClientAdapter {
  final requests = <(String, Object?)>[];

  static const _bodies = <String, Map<String, dynamic>>{
    '/api/users/me/mfa/enroll/start': {
      'otpauthUrl': 'otpauth://totp/PON:mia@acme.com?secret=JBSWY3DPEHPK3PXP',
      'secret': 'JBSWY3DPEHPK3PXP',
      'qrDataUrl': kTinyPngDataUrl,
    },
    '/api/users/me/mfa/enroll/confirm': {
      'code': 'MFA_BACKUP_CODES_ISSUED',
      'backupCodes': [
        'AAAAA-BBBBB', 'CCCCC-DDDDD', 'EEEEE-FFFFF', 'GGGGG-HHHHH',
        'IIIII-JJJJJ', 'KKKKK-LLLLL', 'MMMMM-NNNNN', 'OOOOO-PPPPP',
        'QQQQQ-RRRRR', 'SSSSS-TTTTT',
      ],
    },
    '/api/users/me/mfa/disable': {'success': true},
  };

  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add((options.path, options.data));
    return ResponseBody.fromString(
      jsonEncode(_bodies[options.path] ?? const {}),
      201,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _Adapter adapter;
  late AuthRepository repo;
  const storage = FlutterSecureStorage();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    adapter = _Adapter();
    repo = AuthRepository(storage, Dio()..httpClientAdapter = adapter);
  });

  group('self-service 2FA calls', () {
    test('enroll/start → the authenticator material', () async {
      final enrollment = await repo.selfMfaEnrollStart();
      expect(adapter.requests.single.$1, '/api/users/me/mfa/enroll/start');
      expect(enrollment.secret, 'JBSWY3DPEHPK3PXP');
      expect(enrollment.otpauthUrl, startsWith('otpauth://'));
      expect(enrollment.qrPngBytes, isNotNull);
    });

    test('enroll/confirm sends {code}, returns the 10 codes, stores nothing',
        () async {
      final codes = await repo.selfMfaEnrollConfirm('123456');
      expect(adapter.requests.single.$1, '/api/users/me/mfa/enroll/confirm');
      expect(adapter.requests.single.$2, {'code': '123456'});
      expect(codes, hasLength(10));
      expect(codes.first, 'AAAAA-BBBBB');
      expect(await storage.readAll(), isEmpty,
          reason: 'turning 2FA on never touches the session');
    });

    test('disable sends exactly the one proof given', () async {
      await repo.selfMfaDisable(code: '654321');
      await repo.selfMfaDisable(backupCode: 'ABCDE-FGHIJ');
      expect(adapter.requests.map((r) => r.$1).toSet(),
          {'/api/users/me/mfa/disable'});
      expect(adapter.requests[0].$2, {'code': '654321'});
      expect(adapter.requests[1].$2, {'backupCode': 'ABCDE-FGHIJ'});
    });
  });

  group('UserModel.mfaAvailable', () {
    UserModel parse(Map<String, dynamic> flags) => UserModel.fromJson(
        {'id': 'u1', 'email': 'a@acme.com', 'displayName': 'A', ...flags});

    test('read from /me', () {
      expect(parse({'mfaAvailable': true}).mfaAvailable, isTrue);
      final sso = parse({'mfaAvailable': false, 'mfaEnabled': true});
      expect(sso.mfaAvailable, isFalse, reason: 'explicit value wins');
    });

    test('older payloads fall back to required || enabled', () {
      expect(parse({}).mfaAvailable, isFalse);
      expect(parse({'mfaRequired': true}).mfaAvailable, isTrue);
      expect(parse({'mfaEnabled': true}).mfaAvailable, isTrue);
    });

    test('survives the session cache round trip', () {
      final user = parse({'mfaAvailable': true, 'mfaEnabled': false});
      final again = UserModel.fromJson(user.toJson());
      expect(again.mfaAvailable, isTrue);
      expect(again.mfaEnabled, isFalse);
    });

    test('withMfaEnabled flips only that flag', () {
      final user = parse({
        'mfaAvailable': true,
        'hasPassword': true,
        'roleName': 'Member',
      }).withMfaEnabled(true);
      expect(user.mfaEnabled, isTrue);
      expect(user.mfaAvailable, isTrue);
      expect(user.mfaRequired, isFalse);
      expect(user.hasPassword, isTrue);
      expect(user.roleName, 'Member');
    });
  });
}
