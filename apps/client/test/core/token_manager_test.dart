import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:platform_client/core/api/token_manager.dart';

class _MockStorage extends Mock implements FlutterSecureStorage {}

class _MockDio extends Mock implements Dio {}

void main() {
  late _MockStorage storage;
  late _MockDio dio;
  late TokenManager tm;

  setUp(() {
    storage = _MockStorage();
    dio = _MockDio();
    tm = TokenManager(storage, refreshDio: dio);

    // Valid stored refresh credentials.
    when(() => storage.read(key: 'refreshToken'))
        .thenAnswer((_) async => 'v0.oldrefresh');
    when(() => storage.read(key: 'sid')).thenAnswer((_) async => 'sid-123');
    when(() => storage.write(key: any(named: 'key'), value: any(named: 'value')))
        .thenAnswer((_) async {});
  });

  RequestOptions reqOpts() => RequestOptions(path: '/auth/refresh');

  group('TokenManager.forceRefresh', () {
    test('returns the new access token and persists rotated tokens on success',
        () async {
      when(() => dio.post(any(), data: any(named: 'data'))).thenAnswer(
        (_) async => Response(
          requestOptions: reqOpts(),
          statusCode: 201,
          data: {'accessToken': 'newAccess', 'refreshToken': 'v1.newrefresh'},
        ),
      );

      final result = await tm.forceRefresh();

      expect(result, 'newAccess');
      verify(() => storage.write(key: 'accessToken', value: 'newAccess'))
          .called(1);
      verify(() => storage.write(key: 'refreshToken', value: 'v1.newrefresh'))
          .called(1);
    });

    test('throws RefreshRejectedException when the server rejects with 401',
        () async {
      when(() => dio.post(any(), data: any(named: 'data'))).thenThrow(
        DioException(
          requestOptions: reqOpts(),
          response: Response(requestOptions: reqOpts(), statusCode: 401),
          type: DioExceptionType.badResponse,
        ),
      );

      await expectLater(
        tm.forceRefresh(),
        throwsA(isA<RefreshRejectedException>()),
      );
      // Must NOT wipe credentials as a side effect of a rejection here; that is
      // the Dio interceptor's job.
      verifyNever(() => storage.delete(key: any(named: 'key')));
    });

    test('throws RefreshRejectedException when the server rejects with 403',
        () async {
      when(() => dio.post(any(), data: any(named: 'data'))).thenThrow(
        DioException(
          requestOptions: reqOpts(),
          response: Response(requestOptions: reqOpts(), statusCode: 403),
          type: DioExceptionType.badResponse,
        ),
      );

      await expectLater(
        tm.forceRefresh(),
        throwsA(isA<RefreshRejectedException>()),
      );
    });

    test('returns null (NO throw) on a transient connection error — the bug fix',
        () async {
      // This is the exact iOS background→resume scenario: the network is not
      // ready, the refresh throws a connectionError with no response. The old
      // code returned null → logout+deleteAll. It must NOT be treated as a
      // rejection now.
      when(() => dio.post(any(), data: any(named: 'data'))).thenThrow(
        DioException(
          requestOptions: reqOpts(),
          type: DioExceptionType.connectionError,
          error: 'Connection reset by peer',
        ),
      );

      final result = await tm.forceRefresh();
      expect(result, isNull);
    });

    test('returns null on a 5xx server error (transient, not a rejection)',
        () async {
      when(() => dio.post(any(), data: any(named: 'data'))).thenThrow(
        DioException(
          requestOptions: reqOpts(),
          response: Response(requestOptions: reqOpts(), statusCode: 503),
          type: DioExceptionType.badResponse,
        ),
      );

      final result = await tm.forceRefresh();
      expect(result, isNull);
    });

    test('returns null on receive timeout (transient)', () async {
      when(() => dio.post(any(), data: any(named: 'data'))).thenThrow(
        DioException(
          requestOptions: reqOpts(),
          type: DioExceptionType.receiveTimeout,
        ),
      );

      final result = await tm.forceRefresh();
      expect(result, isNull);
    });
  });

  test('getValidAccessToken swallows a rejection and returns null', () async {
    // STOMP/reconnect callers must never see the exception (they just skip
    // connecting). Access token is expired/absent so a refresh is attempted.
    when(() => storage.read(key: 'accessToken')).thenAnswer((_) async => null);
    when(() => dio.post(any(), data: any(named: 'data'))).thenThrow(
      DioException(
        requestOptions: reqOpts(),
        response: Response(requestOptions: reqOpts(), statusCode: 401),
        type: DioExceptionType.badResponse,
      ),
    );

    final result = await tm.getValidAccessToken();
    expect(result, isNull);
  });
}
