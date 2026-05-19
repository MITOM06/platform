import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
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
      'otpCode': otpCode,
    });
  }

  Future<void> forgotPassword(String email) async {
    await _dio.post('/auth/forgot-password', data: {'email': email});
  }

  Future<void> resetPassword(
      String email, String otpCode, String newPassword) async {
    await _dio.post('/auth/reset-password', data: {
      'email': email,
      'otpCode': otpCode,
      'newPassword': newPassword,
    });
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
    await Future.wait([
      _storage.write(key: _keyAccessToken, value: accessToken),
      _storage.write(key: _keyRefreshToken, value: refreshToken),
      _storage.write(key: _keySid, value: sid),
      _storage.write(key: _keyUser, value: jsonEncode(user.toJson())),
    ]);
  }

  Future<void> clearCredentials() => _storage.deleteAll();
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  const storage = FlutterSecureStorage();
  return AuthRepository(storage, DioClient.createAuthDio(storage));
});
