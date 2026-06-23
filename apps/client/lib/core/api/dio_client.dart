import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';
import '../utils/app_error.dart';
import '../utils/global_messenger.dart';

const _keyAccessToken = 'accessToken';
const _keyRefreshToken = 'refreshToken';
const _keySid = 'sid';

class DioClient {
  /// Public base URL of the chat-service, used e.g. to resolve relative
  /// avatar/upload URLs returned by the server.
  static String get chatBaseUrl => AppConfig.chatBaseUrl;

  /// Public base URL of the connector-service (MCP connectors / integrations).
  static String get connectorBaseUrl => AppConfig.connectorBaseUrl;

  /// Public base URL of the ai-service (:3002).
  static String get aiBaseUrl => AppConfig.aiBaseUrl;

  static Dio createAuthDio(
    FlutterSecureStorage storage, {
    void Function()? onForceLogout,
  }) {
    final dio = Dio(BaseOptions(
      baseUrl: AppConfig.authBaseUrl,
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

  static Dio createChatDio(
    FlutterSecureStorage storage, {
    void Function()? onForceLogout,
  }) {
    final dio = Dio(BaseOptions(
      baseUrl: AppConfig.chatBaseUrl,
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

  /// Dio for the ai-service (:3002). Carries the same JWT/refresh/error
  /// interceptors as the other services. Used by the admin usage/quality
  /// dashboard (`GET /usage/dashboard`). NEVER reuse the chat/auth Dio for this
  /// — base URLs differ and mixing them is a known footgun.
  static Dio createAiDio(
    FlutterSecureStorage storage, {
    void Function()? onForceLogout,
  }) {
    final dio = Dio(BaseOptions(
      baseUrl: AppConfig.aiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));
    dio.interceptors.add(_AuthHeaderInterceptor(storage));
    dio.interceptors.add(const _NetworkErrorInterceptor());
    dio.interceptors.add(
      _TokenRefreshInterceptor(storage, dio, onForceLogout: onForceLogout),
    );
    return dio;
  }

  /// Dio for the connector-service (:3003). Carries the same JWT/refresh/error
  /// interceptors as the other services so per-user OAuth + MCP calls are
  /// authenticated identically. NEVER reuse the chat/auth Dio for this — base
  /// URLs differ and mixing them is a known footgun.
  static Dio createConnectorDio(
    FlutterSecureStorage storage, {
    void Function()? onForceLogout,
  }) {
    final dio = Dio(BaseOptions(
      baseUrl: AppConfig.connectorBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
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
      final refreshDio = Dio(BaseOptions(baseUrl: AppConfig.authBaseUrl));
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

  /// Delete only the auth tokens — NOT the whole secure store. Using
  /// deleteAll() would wipe unrelated secrets other features may persist.
  Future<void> _clearCredentials() async {
    await Future.wait([
      _storage.delete(key: _keyAccessToken),
      _storage.delete(key: _keyRefreshToken),
      _storage.delete(key: _keySid),
    ]);
  }
}
