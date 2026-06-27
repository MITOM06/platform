import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

const _keyAccessToken = 'accessToken';
const _keyRefreshToken = 'refreshToken';
const _keySid = 'sid';

/// Refresh the access token this many seconds BEFORE it actually expires, so a
/// STOMP CONNECT never races a just-expired token. Mirrors the web client's
/// `isTokenExpiredOrExpiringSoon` 60-second skew.
const _expirySkew = Duration(seconds: 60);

/// Single source of truth for obtaining a *valid* access token.
///
/// Why this exists: STOMP CONNECT is rejected by the chat-service
/// `AuthChannelInterceptor` when the JWT is expired, and `stomp_dart_client`
/// then auto-reconnects forever with the SAME dead token. Unlike Dio (which
/// refreshes reactively on a 401), the WebSocket has no 401 to react to — so we
/// must refresh PROACTIVELY before each (re)connect.
///
/// This mirrors `apps/web/lib/stomp/client.ts`'s `beforeConnect` hook:
/// decode the JWT `exp`, and if it is expired/expiring-soon, refresh via the
/// existing auth refresh endpoint. Refresh tokens ROTATE with reuse detection,
/// so the rotated `refreshToken` (and new `accessToken`) MUST be persisted —
/// failing to do so causes logout loops.
class TokenManager {
  TokenManager(this._storage);

  final FlutterSecureStorage _storage;

  /// Guards against concurrent refreshes (e.g. STOMP reconnect + a Dio 401
  /// firing at once) reusing the same rotating refresh token twice.
  Future<String?>? _inFlight;

  /// Returns a valid access token, refreshing first if it is missing,
  /// unparseable, or expiring within [_expirySkew]. Returns `null` only when
  /// there is genuinely no way to obtain one (no refresh token, or the refresh
  /// itself failed) — callers should then skip connecting rather than loop on a
  /// dead token.
  Future<String?> getValidAccessToken() async {
    final access = await _storage.read(key: _keyAccessToken);
    if (access != null && !_isExpiredOrExpiringSoon(access)) {
      return access;
    }
    // Coalesce concurrent refreshes onto a single in-flight future.
    _inFlight ??= _refresh();
    try {
      return await _inFlight;
    } finally {
      _inFlight = null;
    }
  }

  Future<String?> _refresh() async {
    final refreshToken = await _storage.read(key: _keyRefreshToken);
    final sid = await _storage.read(key: _keySid);
    if (refreshToken == null || sid == null) return null;

    try {
      // Bare Dio — no interceptors — to avoid refresh/401 loops.
      final dio = Dio(BaseOptions(baseUrl: AppConfig.authBaseUrl));
      final res = await dio.post('/auth/refresh', data: {
        'sid': sid,
        'refreshToken': refreshToken,
      });
      final data = res.data as Map<String, dynamic>;
      final newAccess = data['accessToken'] as String;
      final newRefresh = data['refreshToken'] as String;
      // Persist BOTH — refresh tokens rotate; dropping the new one logs out.
      await _storage.write(key: _keyAccessToken, value: newAccess);
      await _storage.write(key: _keyRefreshToken, value: newRefresh);
      return newAccess;
    } catch (e) {
      debugPrint('[TokenManager] refresh failed: $e');
      return null;
    }
  }

  /// Decodes a JWT and returns true if it is expired or will expire within
  /// [_expirySkew]. Treats an unparseable token as "expired" so we refresh
  /// rather than connect with garbage. No external package — split on `.`,
  /// base64Url-decode the payload segment, then read `exp` (seconds).
  static bool _isExpiredOrExpiringSoon(String jwt) {
    try {
      final parts = jwt.split('.');
      if (parts.length != 3) return true;
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
      ) as Map<String, dynamic>;
      final exp = payload['exp'];
      if (exp is! num) return true;
      final expiresAt = DateTime.fromMillisecondsSinceEpoch(exp.toInt() * 1000);
      return DateTime.now().add(_expirySkew).isAfter(expiresAt);
    } catch (_) {
      return true;
    }
  }
}
