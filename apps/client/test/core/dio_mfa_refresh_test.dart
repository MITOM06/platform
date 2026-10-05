import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/api/dio_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Answers every request with [status] + JSON [body] and counts the calls.
class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this.status, this.body);
  final int status;
  final Map<String, dynamic> body;
  final paths = <String>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    paths.add(options.path);
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
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

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<(int, List<String>, Map<String, String>)> run(
    String code, {
    required Map<String, String> stored,
  }) async {
    FlutterSecureStorage.setMockInitialValues(Map.of(stored));
    const storage = FlutterSecureStorage();
    var forcedLogouts = 0;
    final dio = DioClient.createAuthDio(
      storage,
      onForceLogout: () => forcedLogouts++,
    );
    final adapter = _StubAdapter(401, {'code': code});
    dio.httpClientAdapter = adapter;

    await expectLater(
      dio.post('/auth/mfa/verify', data: {'mfaToken': 't', 'code': '000000'}),
      throwsA(isA<DioException>()),
    );
    return (forcedLogouts, adapter.paths, await storage.readAll());
  }

  test('a wrong MFA code (401 MFA_CODE_INVALID) is passed through as is',
      () async {
    final (logouts, paths, _) = await run('MFA_CODE_INVALID', stored: {});
    expect(logouts, 0, reason: 'a pending sign-in must survive a wrong code');
    expect(paths, ['/auth/mfa/verify']);
  });

  test('a 401 MFA_* on a signed-in call never refreshes or logs out',
      () async {
    final session = {
      'accessToken': 'a',
      'refreshToken': 'r',
      'sid': 's',
    };
    final (logouts, paths, after) =
        await run('MFA_CODE_INVALID', stored: session);
    expect(logouts, 0);
    expect(paths, ['/auth/mfa/verify'], reason: 'no /auth/refresh, no retry');
    expect(after, session, reason: 'credentials untouched');
  });

  test('other anonymous 401s keep the old behaviour', () async {
    final (logouts, _, _) = await run('LOGIN_FAILED_WITH_REMAINING', stored: {});
    expect(logouts, 1);
  });
}
