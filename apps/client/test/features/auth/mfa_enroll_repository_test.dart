import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/data/auth_repository.dart';

const _codes = [
  'AAAAA-BBBBB', 'CCCCC-DDDDD', 'EEEEE-FFFFF', 'GGGGG-HHHHH', 'IIIII-JJJJJ',
  'KKKKK-LLLLL', 'MMMMM-NNNNN', 'OOOOO-PPPPP', 'QQQQQ-RRRRR', 'SSSSS-TTTTT',
];

/// Answers `/auth/mfa/enroll/*` like auth-service after contract 11 and
/// records every request (path + JSON body).
class _EnrollAdapter implements HttpClientAdapter {
  final requests = <(String, Map<String, dynamic>)>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(
        (options.path, Map<String, dynamic>.from(options.data as Map)));
    final body = switch (options.path) {
      '/auth/mfa/enroll/confirm' => {
          'code': 'MFA_BACKUP_CODES_ISSUED',
          'backupCodes': _codes,
        },
      '/auth/mfa/enroll/complete' => {
          'code': 'LOGIN_SUCCESS',
          'accessToken': 'access-1',
          'refreshToken': 'refresh-1',
          'sid': 'sid-1',
          'user': {
            'id': 'u1',
            'email': 'olga@acme.com',
            'displayName': 'Olga',
            'mfaEnabled': true,
            'mfaRequired': true,
          },
        },
      _ => throw StateError('unexpected ${options.path}'),
    };
    return ResponseBody.fromString(
      jsonEncode(body),
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

  late _EnrollAdapter adapter;
  late FlutterSecureStorage storage;
  late AuthRepository repo;

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    storage = const FlutterSecureStorage();
    adapter = _EnrollAdapter();
    final dio = Dio()..httpClientAdapter = adapter;
    repo = AuthRepository(storage, dio);
  });

  test('confirm returns the backup codes and saves no session', () async {
    final codes = await repo.mfaEnrollConfirm('tok_enroll', '246810');

    expect(codes, _codes);
    expect(adapter.requests.map((r) => r.$1), ['/auth/mfa/enroll/confirm']);
    expect(adapter.requests.single.$2,
        {'mfaToken': 'tok_enroll', 'code': '246810'});
    expect(await storage.readAll(), isEmpty,
        reason: 'no tokens / user may exist before the codes are acknowledged');
    expect(await repo.getStoredUser(), isNull);
  });

  test('complete saves the session and returns the user', () async {
    await repo.mfaEnrollConfirm('tok_enroll', '246810');
    final user = await repo.mfaEnrollComplete('tok_enroll');

    expect(user.id, 'u1');
    expect(user.mfaEnabled, isTrue);
    expect(adapter.requests.last.$1, '/auth/mfa/enroll/complete');
    expect(adapter.requests.last.$2,
        {'mfaToken': 'tok_enroll', 'platform': 'mobile'});
    final stored = await storage.readAll();
    expect(stored['accessToken'], 'access-1');
    expect(stored['refreshToken'], 'refresh-1');
    expect(stored['sid'], 'sid-1');
    expect((await repo.getStoredUser())?.email, 'olga@acme.com');
  });
}
