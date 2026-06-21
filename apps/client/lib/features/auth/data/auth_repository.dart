import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../domain/auth_provider.dart';
import '../domain/auth_state.dart';

const _keyAccessToken = 'accessToken';
const _keyRefreshToken = 'refreshToken';
const _keySid = 'sid';
const _keyUser = 'user';

class AuthRepository {
  final FlutterSecureStorage _storage;
  final Dio _dio;

  const AuthRepository(this._storage, this._dio);

  Future<UserModel> login(String email, String password) async {
    final response = await _dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    final data = response.data as Map<String, dynamic>;
    final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
    await _saveCredentials(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      sid: data['sid'] as String,
      user: user,
    );
    return user;
  }

  Future<void> register(
      String displayName, String email, String password) async {
    await _dio.post('/auth/register', data: {
      'displayName': displayName,
      'email': email,
      'password': password,
    });
  }

  Future<void> verifyOtp(String email, String otpCode) async {
    await _dio.post('/auth/verify-otp', data: {
      'email': email,
      'otp': otpCode,
    });
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

  /// Đổi OAuth code (từ deeplink platform://auth?code=xxx) lấy JWT tokens
  Future<UserModel> exchangeCode(String code) async {
    final response = await _dio.post('/auth/exchange', data: {
      'code': code,
      'platform': 'mobile',
    });
    final data = response.data as Map<String, dynamic>;
    final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
    await _saveCredentials(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      sid: data['sid'] as String,
      user: user,
    );
    return user;
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

  Future<void> clearCredentials() => _storage.deleteAll();

  /// Lấy public profile của bất kỳ user nào theo id — dùng cho chat UI
  Future<UserModel> getUserProfile(String userId) async {
    final response = await _dio.get('/api/users/$userId');
    return UserModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Tìm kiếm user theo email hoặc displayName — dùng khi tạo conversation
  Future<List<UserModel>> searchUsers(String query) async {
    final response = await _dio.get('/api/users/search', queryParameters: {'q': query});
    final list = response.data as List;
    return list.map((e) => UserModel.fromJson(e as Map<String, dynamic>)).toList();
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
    
    // Update local storage
    final userJson = await _storage.read(key: _keyUser);
    if (userJson != null) {
      await _storage.write(key: _keyUser, value: jsonEncode(updated.toJson()));
    }
    
    return updated;
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    await _dio.post('/api/users/me/change-password', data: {
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
