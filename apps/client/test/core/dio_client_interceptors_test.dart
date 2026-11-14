// DioClient interceptors: bearer header, Accept-Language for auth-service,
// 403 ACCOUNT_BLOCKED forcing a logout (only for signed-in calls), 401 without
// refresh credentials, a non-401 passing through, and base URLs per service.

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/api/dio_client.dart';
import 'package:platform_client/core/config/app_config.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.status, [this.body = const {}]);
  final int status;
  final Map<String, dynamic> body;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    return ResponseBody.fromString(jsonEncode(body), status,
        headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});
  }

  @override
  void close({bool force = false}) {}
}

const _session = {'accessToken': 'acc', 'refreshToken': 'ref', 'sid': 's1'};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('signed-in requests carry the bearer token', () async {
    FlutterSecureStorage.setMockInitialValues(Map.of(_session));
    final dio = DioClient.createChatDio(const FlutterSecureStorage());
    final a = _Adapter(200);
    dio.httpClientAdapter = a;
    await dio.get('/api/x');
    expect(a.requests.single.headers['Authorization'], 'Bearer acc');
  });

  test('anonymous requests carry no Authorization header', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final dio = DioClient.createAiDio(const FlutterSecureStorage());
    final a = _Adapter(200);
    dio.httpClientAdapter = a;
    await dio.get('/health');
    expect(a.requests.single.headers.containsKey('Authorization'), isFalse);
  });

  group('Accept-Language (auth-service only)', () {
    Future<Object?> lang(Map<String, Object> prefs) async {
      SharedPreferences.setMockInitialValues(prefs);
      FlutterSecureStorage.setMockInitialValues({});
      final dio = DioClient.createAuthDio(const FlutterSecureStorage());
      final a = _Adapter(200);
      dio.httpClientAdapter = a;
      await dio.post('/auth/otp');
      return a.requests.single.headers['Accept-Language'];
    }

    test('the stored supported locale', () async {
      expect(await lang({'app_locale': 'vi'}), 'vi');
    });

    test('unsupported or missing → en', () async {
      expect(await lang({'app_locale': 'de'}), 'en');
      expect(await lang({}), 'en');
    });
  });

  group('403 ACCOUNT_BLOCKED', () {
    test('signed in: credentials cleared and forced logout', () async {
      FlutterSecureStorage.setMockInitialValues(Map.of(_session));
      const storage = FlutterSecureStorage();
      var logouts = 0;
      final dio = DioClient.createConnectorDio(storage,
          onForceLogout: () => logouts++);
      dio.httpClientAdapter = _Adapter(403, {'code': 'ACCOUNT_BLOCKED'});
      await expectLater(dio.get('/api/x'), throwsA(isA<DioException>()));
      expect(logouts, 1);
      final left = await storage.readAll();
      expect(left.containsKey('accessToken'), isFalse);
      expect(left.containsKey('refreshToken'), isFalse);
    });

    test('anonymous (login form): no logout, nothing cleared', () async {
      FlutterSecureStorage.setMockInitialValues({'other': 'x'});
      const storage = FlutterSecureStorage();
      var logouts = 0;
      final dio =
          DioClient.createAuthDio(storage, onForceLogout: () => logouts++);
      dio.httpClientAdapter = _Adapter(403, {'code': 'ACCOUNT_BLOCKED'});
      await expectLater(dio.post('/auth/login'), throwsA(isA<DioException>()));
      expect(logouts, 0);
      expect(await storage.readAll(), {'other': 'x'});
    });

    test('a different 403 code does not log out', () async {
      FlutterSecureStorage.setMockInitialValues(Map.of(_session));
      var logouts = 0;
      final dio = DioClient.createChatDio(const FlutterSecureStorage(),
          onForceLogout: () => logouts++);
      dio.httpClientAdapter = _Adapter(403, {'code': 'FORBIDDEN'});
      await expectLater(
          dio.get('/api/x'),
          throwsA(isA<DioException>()
              .having((e) => e.response?.statusCode, 'status', 403)));
      expect(logouts, 0);
    });
  });

  test('401 without refresh credentials clears the session and logs out',
      () async {
    FlutterSecureStorage.setMockInitialValues({'accessToken': 'acc'});
    const storage = FlutterSecureStorage();
    var logouts = 0;
    final dio =
        DioClient.createChatDio(storage, onForceLogout: () => logouts++);
    final a = _Adapter(401, {'code': 'TOKEN_INVALID'});
    dio.httpClientAdapter = a;
    await expectLater(dio.get('/api/x'), throwsA(isA<DioException>()));
    expect(logouts, 1);
    expect(a.requests.length, 1, reason: 'no retry without a refresh');
    expect((await storage.readAll()).containsKey('accessToken'), isFalse);
  });

  test('a network error is surfaced as is (snackbar path, no logout)',
      () async {
    FlutterSecureStorage.setMockInitialValues(Map.of(_session));
    var logouts = 0;
    final dio = DioClient.createChatDio(const FlutterSecureStorage(),
        onForceLogout: () => logouts++);
    dio.httpClientAdapter = _ThrowingAdapter();
    await expectLater(
        dio.get('/api/x'),
        throwsA(isA<DioException>().having(
            (e) => e.type, 'type', DioExceptionType.connectionError)));
    expect(logouts, 0);
  });

  test('each service gets its own base URL', () {
    const s = FlutterSecureStorage();
    expect(DioClient.createAuthDio(s).options.baseUrl, AppConfig.authBaseUrl);
    expect(DioClient.createChatDio(s).options.baseUrl, AppConfig.chatBaseUrl);
    expect(DioClient.createAiDio(s).options.baseUrl, AppConfig.aiBaseUrl);
    expect(DioClient.createConnectorDio(s).options.baseUrl,
        AppConfig.connectorBaseUrl);
    expect(DioClient.aiBaseUrl, AppConfig.aiBaseUrl);
    expect(DioClient.connectorBaseUrl, AppConfig.connectorBaseUrl);
  });
}

class _ThrowingAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    throw DioException(
        requestOptions: options, type: DioExceptionType.connectionError);
  }

  @override
  void close({bool force = false}) {}
}
