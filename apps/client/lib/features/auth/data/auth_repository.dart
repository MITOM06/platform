import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../domain/auth_provider.dart';
import '../domain/auth_state.dart';
import '../domain/invitation_preview.dart';
import '../domain/mfa_models.dart';
import '../domain/sso_info.dart';

const _keyAccessToken = 'accessToken';
const _keyRefreshToken = 'refreshToken';
const _keySid = 'sid';
const _keyUser = 'user';

class AuthRepository {
  final FlutterSecureStorage _storage;
  final Dio _dio;

  const AuthRepository(this._storage, this._dio);

  /// Password sign-in. An Owner / Admin-like member — and a Member who turned
  /// 2FA on (contract 15) — gets [SignInMfaRequired] instead of a session:
  /// nothing is persisted until the second factor succeeds (`mfaVerify` /
  /// `mfaEnrollComplete`). Any other Member signs in directly. A member whose
  /// email domain must use SSO is refused with 403 `SSO_REQUIRED`.
  Future<SignInResult> login(String email, String password) async {
    final response = await _dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return _signInResult(response.data as Map<String, dynamic>);
  }

  /// `MFA_REQUIRED` body → the challenge; any other body is a login success
  /// whose session is persisted.
  Future<SignInResult> _signInResult(Map<String, dynamic> data) async {
    if (data['code'] == 'MFA_REQUIRED') {
      return SignInMfaRequired(MfaChallenge.fromJson(data));
    }
    return SignInSuccess(await _persistSession(data));
  }

  /// Persists the tokens of a login-success body (login, exchange, invitation
  /// accept, MFA verify / enroll complete all share it) and returns its user.
  Future<UserModel> _persistSession(Map<String, dynamic> data) async {
    final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
    await _saveCredentials(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      sid: data['sid'] as String,
      user: user,
    );
    return user;
  }

  // ── Two-factor authentication (contract 09) ─────────────────────────────
  // The `/auth/mfa/*` calls are public (no JWT): the single-use `mfaToken`
  // from the login/exchange response identifies the pending sign-in. Wrong
  // codes answer 401 `MFA_*`, which the Dio refresh interceptor leaves alone.

  /// Starts enrollment: secret + QR for the authenticator app. Calling it
  /// again with the same token returns the same pending secret.
  Future<MfaEnrollment> mfaEnrollStart(String mfaToken) async {
    final res = await _dio.post('/auth/mfa/enroll/start', data: {
      'mfaToken': mfaToken,
    });
    return MfaEnrollment.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  /// Confirms enrollment with the first code. The account is now enrolled but
  /// NO session is issued (`MFA_BACKUP_CODES_ISSUED` — contract 11): returns
  /// the 10 backup codes, which the caller must show once and have
  /// acknowledged before [mfaEnrollComplete]. Persists nothing.
  Future<List<String>> mfaEnrollConfirm(String mfaToken, String code) async {
    final res = await _dio.post('/auth/mfa/enroll/confirm', data: {
      'mfaToken': mfaToken,
      'code': code,
    });
    return _codeList((res.data as Map)['backupCodes']);
  }

  /// "I saved my backup codes" → the session (persisted) and its user. Single
  /// use, only after [mfaEnrollConfirm] and within its 10-minute window;
  /// otherwise `MFA_TOKEN_INVALID` / `MFA_NOT_ENROLLED`.
  Future<UserModel> mfaEnrollComplete(String mfaToken) async {
    final res = await _dio.post('/auth/mfa/enroll/complete', data: {
      'mfaToken': mfaToken,
      'platform': 'mobile',
    });
    return _persistSession(Map<String, dynamic>.from(res.data as Map));
  }

  /// Second factor of a sign-in: exactly one of [code] (TOTP) or
  /// [backupCode] (`XXXXX-XXXXX`) → session (persisted).
  Future<MfaSignIn> mfaVerify(
    String mfaToken, {
    String? code,
    String? backupCode,
  }) async {
    final res = await _dio.post('/auth/mfa/verify', data: {
      'mfaToken': mfaToken,
      if (code != null) 'code': code,
      if (backupCode != null) 'backupCode': backupCode,
      'platform': 'mobile',
    });
    final data = Map<String, dynamic>.from(res.data as Map);
    return MfaSignIn(
      user: await _persistSession(data),
      backupCodesRemaining: (data['backupCodesRemaining'] as num?)?.toInt(),
    );
  }

  /// Replaces the signed-in member's backup codes; [code] is a current TOTP
  /// code (`POST /api/users/me/mfa/backup-codes`).
  Future<List<String>> regenerateBackupCodes(String code) async {
    final res = await _dio.post('/api/users/me/mfa/backup-codes', data: {
      'code': code,
    });
    return _codeList((res.data as Map)['backupCodes']);
  }

  // ── Own optional 2FA (contract 15 — Settings → Security) ────────────────
  // Signed-in (JWT) calls for a member whose role doesn't require 2FA. Errors
  // are 400 `MFA_*` (never 401), so a mistyped code can't trip the Dio
  // refresh-then-logout handling. `SSO_REQUIRED` for an SSO-enforced member.

  /// "Turn on 2FA", step 1: secret + QR for the authenticator app (pending
  /// server-side for 10 minutes). `MFA_ALREADY_ENROLLED` if it is already on.
  Future<MfaEnrollment> selfMfaEnrollStart() async {
    final res = await _dio.post('/api/users/me/mfa/enroll/start');
    return MfaEnrollment.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  /// "Turn on 2FA", step 2: the first [code] turns 2FA on (the session is
  /// untouched) and returns the 10 backup codes, shown once
  /// (`MFA_BACKUP_CODES_ISSUED`). Wrong code → `MFA_CODE_INVALID`
  /// (`params.remaining`); 5 wrong → `MFA_TOO_MANY_ATTEMPTS`.
  Future<List<String>> selfMfaEnrollConfirm(String code) async {
    final res = await _dio.post('/api/users/me/mfa/enroll/confirm', data: {
      'code': code,
    });
    return _codeList((res.data as Map)['backupCodes']);
  }

  /// "Turn off 2FA" with exactly one of a current TOTP [code] or an unused
  /// [backupCode] (`XXXXX-XXXXX`). Refused with `MFA_REQUIRED_BY_ROLE` when
  /// the role requires 2FA, `MFA_NOT_ENROLLED` when it is already off.
  Future<void> selfMfaDisable({String? code, String? backupCode}) async {
    await _dio.post('/api/users/me/mfa/disable', data: {
      if (code != null) 'code': code,
      if (backupCode != null) 'backupCode': backupCode,
    });
  }

  static List<String> _codeList(dynamic raw) =>
      (raw as List<dynamic>? ?? const []).map((e) => e.toString()).toList();

  /// Public preview of an invitation (`GET /auth/invitations/:token`).
  /// Throws a DioException carrying `INVITATION_INVALID` / `_EXPIRED` /
  /// `_REVOKED` / `_ALREADY_ACCEPTED` when the link can't be used.
  Future<InvitationPreview> getInvitation(String token) async {
    final res =
        await _dio.get('/auth/invitations/${Uri.encodeComponent(token)}');
    return InvitationPreview.fromJson(
        Map<String, dynamic>.from(res.data as Map));
  }

  /// Accepts an invitation by choosing a display name + password
  /// (`POST /auth/invitations/:token/accept-password`). The response has the
  /// same shapes as `/auth/login` (contract 15): an Owner / Admin-like invite
  /// gets the `MFA_REQUIRED` challenge (enrollment) — nothing is persisted
  /// until 2FA is set up — while a Member invite gets a login-success body,
  /// persisted like any sign-in. An email in an SSO-enforced domain is refused
  /// with `SSO_REQUIRED`.
  Future<SignInResult> acceptInvitationWithPassword(
    String token,
    String displayName,
    String password,
  ) async {
    final response = await _dio.post(
      '/auth/invitations/${Uri.encodeComponent(token)}/accept-password',
      data: {
        'displayName': displayName,
        'password': password,
        'platform': 'mobile',
      },
    );
    return _signInResult(Map<String, dynamic>.from(response.data as Map));
  }

  Future<void> verifyOtp(String email, String otpCode) async {
    await _dio.post('/auth/verify-otp', data: {
      'email': email,
      'otp': otpCode,
    });
  }

  /// Whether the deployment exposes OIDC SSO (drives the login SSO button).
  Future<SsoInfo> getSsoInfo() async {
    try {
      final res = await _dio.get('/auth/sso/info');
      return SsoInfo.fromJson(Map<String, dynamic>.from(res.data as Map));
    } catch (_) {
      return SsoInfo.disabled;
    }
  }

  Future<void> resendOtp(String email) async {
    await _dio.post('/auth/resend-otp', data: {'email': email});
  }

  Future<void> forgotPassword(String email) async {
    await _dio.post('/auth/forgot-password', data: {'email': email});
  }

  Future<void> resetPassword(
      String email, String otpCode, String newPassword) async {
    await _dio.post('/auth/reset-password', data: {
      'email': email,
      'otp': otpCode,
      'password': newPassword,
    });
  }

  /// Đổi OAuth code (từ deeplink platform://auth?code=xxx) lấy JWT tokens.
  /// Like [login], a Google sign-in of a member who needs 2FA gets
  /// [SignInMfaRequired] first; an OIDC / SSO sign-in is exempt (the company
  /// IdP does MFA) and signs in directly.
  Future<SignInResult> exchangeCode(String code) async {
    final response = await _dio.post('/auth/exchange', data: {
      'code': code,
      'platform': 'mobile',
    });
    return _signInResult(response.data as Map<String, dynamic>);
  }

  Future<void> logout() async {
    final sid = await _storage.read(key: _keySid);
    if (sid != null) {
      try {
        await _dio.post('/auth/logout', data: {'sid': sid});
      } catch (_) {
        // Best-effort — always clear local credentials
      }
    }
    await clearCredentials();
  }

  Future<UserModel?> getStoredUser() async {
    final token = await _storage.read(key: _keyAccessToken);
    final userJson = await _storage.read(key: _keyUser);
    if (token == null || userJson == null) return null;
    try {
      return UserModel.fromJson(
          jsonDecode(userJson) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveCredentials({
    required String accessToken,
    required String refreshToken,
    required String sid,
    required UserModel user,
  }) async {
    await _storage.write(key: _keyAccessToken, value: accessToken);
    await _storage.write(key: _keyRefreshToken, value: refreshToken);
    await _storage.write(key: _keySid, value: sid);
    await _storage.write(key: _keyUser, value: jsonEncode(user.toJson()));
  }

  /// Delete only the auth session keys — NOT the whole secure store.
  /// deleteAll() would wipe unrelated secrets other features may persist
  /// (mirrors _TokenRefreshInterceptor._clearCredentials in dio_client.dart).
  Future<void> clearCredentials() => Future.wait([
        _storage.delete(key: _keyAccessToken),
        _storage.delete(key: _keyRefreshToken),
        _storage.delete(key: _keySid),
        _storage.delete(key: _keyUser),
      ]);

  /// Fetch the authenticated user's own profile (includes `hasPassword`).
  /// Persists the refreshed user into secure storage so the cached session
  /// stays in sync (mirrors web `authService.getMe()`).
  Future<UserModel> getMe() async {
    final response = await _dio.get('/api/users/me');
    final user = UserModel.fromJson(response.data as Map<String, dynamic>);
    await cacheUser(user);
    return user;
  }

  /// Overwrites the persisted session user (only while a session is stored —
  /// never resurrects a signed-out session), so a cold start restores the
  /// latest profile flags such as `mustSetPassword` / `hasPassword`.
  Future<void> cacheUser(UserModel user) async {
    final userJson = await _storage.read(key: _keyUser);
    if (userJson != null) {
      await _storage.write(key: _keyUser, value: jsonEncode(user.toJson()));
    }
  }

  /// Lấy public profile của bất kỳ user nào theo id — dùng cho chat UI
  Future<UserModel> getUserProfile(String userId) async {
    final response = await _dio.get('/api/users/$userId');
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Search users by name/email (partial) or exact phone number.
  ///
  /// The endpoint returns `{ results, matchedBy }`. Phone matches carry a
  /// `phoneNumber` + `matchedBy: 'phone'` on each result so the UI can
  /// highlight the matched number; name/email matches never expose phones.
  Future<List<UserModel>> searchUsers(String query) async {
    final response =
        await _dio.get('/api/users/search', queryParameters: {'q': query});
    final data = response.data as Map<String, dynamic>;
    final results = (data['results'] as List?) ?? const [];
    return results
        .map((e) => UserModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<UserModel> updateProfile({
    String? displayName,
    String? avatarUrl,
    String? bio,
    String? coverPhoto,
    DateTime? dateOfBirth,
    String? phoneNumber,
    String? gender,
    bool? hideInfo,
    bool? showDateOfBirth,
    bool? showPhoneNumber,
    bool? showGender,
  }) async {
    final response = await _dio.patch('/api/users/me', data: {
      if (displayName != null) 'displayName': displayName,
      if (avatarUrl != null) 'avatarUrl': avatarUrl,
      if (bio != null) 'bio': bio,
      if (coverPhoto != null) 'coverPhoto': coverPhoto,
      if (dateOfBirth != null) 'dateOfBirth': dateOfBirth.toUtc().toIso8601String(),
      if (phoneNumber != null) 'phoneNumber': phoneNumber,
      if (gender != null) 'gender': gender,
      if (hideInfo != null) 'hideInfo': hideInfo,
      if (showDateOfBirth != null) 'showDateOfBirth': showDateOfBirth,
      if (showPhoneNumber != null) 'showPhoneNumber': showPhoneNumber,
      if (showGender != null) 'showGender': showGender,
    });
    
    final updated = UserModel.fromJson(response.data as Map<String, dynamic>);
    await cacheUser(updated);
    return updated;
  }

  /// Verifies a Firebase Phone Auth ID token on the server.
  /// The token is obtained after Firebase verifies the SMS OTP client-side.
  /// On success, the server persists the phone number and sets phoneVerified=true.
  Future<String?> verifyFirebasePhoneToken(String idToken) async {
    final response = await _dio.post(
      '/api/users/me/phone/verify',
      data: {'firebaseIdToken': idToken},
    );
    return response.data['phoneNumber'] as String?;
  }

  /// Sets or changes the account password
  /// (`POST /api/users/me/change-password` → `{ success: true }`).
  ///
  /// [currentPassword] is omitted when null/empty: an account without a
  /// password (Google-only, incl. the forced `/set-password` step) creates
  /// its first one; the server answers `CURRENT_PASSWORD_REQUIRED` if the
  /// account does have one. Errors are typed codes (`VAL_PASSWORD_TOO_SHORT`,
  /// `CURRENT_PASSWORD_INCORRECT`, …) — map them with `authErrorMessage`.
  Future<void> changePassword(String? currentPassword, String newPassword) async {
    await _dio.post('/api/users/me/change-password', data: {
      if (currentPassword != null && currentPassword.isNotEmpty)
        'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  Future<void> updateFcmToken(String token) async {
    try {
      await _dio.post('/api/users/device-tokens', data: {'token': token});
    } catch (_) {
      // Best-effort
    }
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  const storage = FlutterSecureStorage();
  return AuthRepository(
    storage,
    DioClient.createAuthDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
