import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../utils/app_error.dart';
import '../utils/global_messenger.dart';

const _authBaseUrl = 'http://localhost:3001';
const _chatBaseUrl = 'http://localhost:8080';

const _keyAccessToken = 'accessToken';
const _keyRefreshToken = 'refreshToken';
const _keySid = 'sid';

class DioClient {
  static Dio createAuthDio(FlutterSecureStorage storage) {
    final dio = Dio(BaseOptions(
      baseUrl: _authBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ));
    dio.interceptors.add(_AuthHeaderInterceptor(storage));
    dio.interceptors.add(const _NetworkErrorInterceptor());
    return dio;
  }

  static Dio createChatDio(
    FlutterSecureStorage storage, {
    void Function()? onForceLogout,
  }) {
    final dio = Dio(BaseOptions(
      baseUrl: _chatBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ));
    dio.interceptors.add(_AuthHeaderInterceptor(storage));
    dio.interceptors.add(const _NetworkErrorInterceptor());
    dio.interceptors.add(
      _TokenRefreshInterceptor(storage, dio, onForceLogout: onForceLogout),
    );
    return dio;
  }
}

/// Attaches Authorization: Bearer <token> to every request if token exists.
class _AuthHeaderInterceptor extends Interceptor {
  final FlutterSecureStorage _storage;

  _AuthHeaderInterceptor(this._storage);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.read(key: _keyAccessToken);
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}

/// Shows a snackbar on network-level failures (no connection, timeout, etc.).
class _NetworkErrorInterceptor extends Interceptor {
  const _NetworkErrorInterceptor();

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (isNetworkError(err)) {
      showErrorSnackBar(friendlyError(err));
    }
    handler.next(err);
  }
}

/// On 401: attempt token refresh, retry original request once.
/// On refresh failure: clear credentials and call onForceLogout if provided.
class _TokenRefreshInterceptor extends Interceptor {
  final FlutterSecureStorage _storage;
  final Dio _dio;
  final void Function()? onForceLogout;
  bool _isRefreshing = false;

  _TokenRefreshInterceptor(
    this._storage,
    this._dio, {
    this.onForceLogout,
  });

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401 || _isRefreshing) {
      return handler.next(err);
    }

    _isRefreshing = true;
    try {
      final refreshToken = await _storage.read(key: _keyRefreshToken);
      final sid = await _storage.read(key: _keySid);

      if (refreshToken == null || sid == null) {
        await _clearCredentials();
        onForceLogout?.call();
        return handler.next(err);
      }

      // Use a fresh Dio to avoid interceptor loops
      final refreshDio = Dio(BaseOptions(baseUrl: _authBaseUrl));
      final response = await refreshDio.post('/auth/refresh', data: {
        'sid': sid,
        'refreshToken': refreshToken,
      });

      final newAccess = response.data['accessToken'] as String;
      final newRefresh = response.data['refreshToken'] as String;
      await _storage.write(key: _keyAccessToken, value: newAccess);
      await _storage.write(key: _keyRefreshToken, value: newRefresh);

      // Retry original request with new token
      final retryOptions = err.requestOptions;
      retryOptions.headers['Authorization'] = 'Bearer $newAccess';
      final retryResponse = await _dio.fetch(retryOptions);
      return handler.resolve(retryResponse);
    } catch (_) {
      await _clearCredentials();
      onForceLogout?.call();
      handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }

  Future<void> _clearCredentials() => _storage.deleteAll();
}
