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

/// Thrown by [TokenManager] when a refresh fails because the SERVER genuinely
/// rejected the refresh token (HTTP 401/403 — expired/rotated/revoked/reused).
/// This is the ONLY condition under which the user should be logged out.
///
/// A transient failure (no response, connect/receive timeout, DNS not ready on
/// resume, 5xx) is NOT this — [TokenManager] returns `null` for those so the
/// caller keeps the session and retries once the network recovers. Mirrors the
/// web client's `isAuthFailure` guard in `apps/web/lib/api/axios.ts`: without
/// this distinction, a flaky refresh on an iOS background→resume cycle wiped
/// the keychain and logged the user out on next launch.
class RefreshRejectedException implements Exception {
  const RefreshRejectedException();
  @override
  String toString() => 'RefreshRejectedException';
}

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
  /// [refreshDio] is a test seam: inject a mockable Dio for the `/auth/refresh`
  /// call. In production it is null and a bare, interceptor-free Dio is built
  /// per refresh (see [_refresh]) to avoid refresh/401 loops.
  TokenManager(this._storage, {Dio? refreshDio}) : _refreshDio = refreshDio;

  final Dio? _refreshDio;

  /// Process-wide shared instance. Refresh MUST be globally single-flight: the
  /// backend rotates refresh tokens with reuse detection, so two concurrent
  /// refreshes (e.g. two Dio instances 401ing at once, or a Dio 401 racing the
  /// STOMP beforeConnect) would spend the same rotating token twice → the token
  /// family is revoked → forced logout. Every Dio interceptor and the STOMP
  /// `beforeConnect` hook use THIS instance so they coalesce onto one in-flight
  /// refresh. Uses `const FlutterSecureStorage()` — the plugin is stateless and
  /// reads/writes the same platform keystore as any other instance.
  static final TokenManager shared = TokenManager(const FlutterSecureStorage());

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
    try {
      return await _coalescedRefresh();
    } on RefreshRejectedException {
      // Session is genuinely dead. Callers of this method (STOMP beforeConnect,
      // conversation-list reconnect) must NOT log the user out or wipe
      // credentials — they simply skip connecting. The Dio 401 interceptor is
      // the single place that performs the actual logout, so it alone reacts to
      // [RefreshRejectedException] (via [forceRefresh]).
      return null;
    }
  }

  /// Forces a token refresh regardless of the local `exp` check, coalescing
  /// concurrent callers onto the single in-flight request. Used by the Dio 401
  /// interceptors: the server rejected the token, so a local-exp check isn't
  /// enough — we must actually refresh, but still only ONCE across all Dio
  /// instances + STOMP.
  Future<String?> forceRefresh() => _coalescedRefresh();

  /// Runs [_refresh] behind a single shared in-flight future so overlapping
  /// callers await the same request rather than each spending the rotating
  /// refresh token.
  Future<String?> _coalescedRefresh() {
    final existing = _inFlight;
    if (existing != null) return existing;
    final future = _refresh();
    _inFlight = future;
    // Clear the slot when the refresh settles. `_refresh` can now throw
    // (RefreshRejectedException), so this cleanup future would otherwise carry
    // an UNOBSERVED error and crash the zone — `.ignore()` marks it handled.
    // The real error/result is still delivered to whoever awaits `future`.
    future.whenComplete(() {
      // Only clear if still ours — a later refresh may have replaced it.
      if (identical(_inFlight, future)) _inFlight = null;
    }).ignore();
    return future;
  }

  /// Returns the new access token on success. Returns `null` on a TRANSIENT
  /// failure (missing local creds, no network response, timeout, 5xx) — the
  /// caller keeps the session and retries later. Throws
  /// [RefreshRejectedException] ONLY when the server rejected the refresh token
  /// with 401/403 (expired/rotated/revoked/reused) — the one case that warrants
  /// a logout.
  Future<String?> _refresh() async {
    final refreshToken = await _storage.read(key: _keyRefreshToken);
    final sid = await _storage.read(key: _keySid);
    if (refreshToken == null || sid == null) return null;

    try {
      // Bare Dio — no interceptors — to avoid refresh/401 loops.
      final dio =
          _refreshDio ?? Dio(BaseOptions(baseUrl: AppConfig.authBaseUrl));
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
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 401 || status == 403) {
        // Server genuinely rejected the refresh token — the session is dead.
        debugPrint('[TokenManager] refresh rejected by server ($status)');
        throw const RefreshRejectedException();
      }
      // Transient: no response (network down / resume race), timeout, or 5xx.
      // Keep the session — do NOT wipe credentials over a flaky network.
      debugPrint('[TokenManager] refresh transient failure: $e');
      return null;
    } catch (e) {
      // Unexpected (e.g. malformed body). Treat as transient rather than wiping
      // the user's session on an ambiguous error.
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
