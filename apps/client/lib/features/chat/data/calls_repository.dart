import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';

/// Media path the server picks for a call: peer-to-peer or LiveKit.
enum CallTransport {
  mesh,
  sfu;

  static CallTransport fromWire(String? value) =>
      value == 'sfu' ? CallTransport.sfu : CallTransport.mesh;
}

class CallConfig {
  final CallTransport transport;
  final String? livekitUrl;

  const CallConfig({required this.transport, this.livekitUrl});

  factory CallConfig.fromJson(Map<String, dynamic> json) => CallConfig(
        transport: CallTransport.fromWire(json['transport'] as String?),
        livekitUrl: json['livekitUrl'] as String?,
      );
}

class CallToken {
  final String url;
  final String token;

  const CallToken({required this.url, required this.token});
}

/// chat-service calls on LiveKit — see docs/api-spec.md "Calls on LiveKit".
abstract class CallsApi {
  Future<CallConfig> getConfig();
  Future<CallToken> getToken(String callId);
}

class CallsRepository implements CallsApi {
  final Dio _dio;

  CallsRepository(this._dio);

  @override
  Future<CallConfig> getConfig() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/calls/config');
    return CallConfig.fromJson(res.data ?? const {});
  }

  @override
  Future<CallToken> getToken(String callId) async {
    final res = await _dio.post<Map<String, dynamic>>(
        '/api/calls/${Uri.encodeComponent(callId)}/token');
    final data = res.data ?? const {};
    return CallToken(
        url: data['url'] as String? ?? '',
        token: data['token'] as String? ?? '');
  }
}

final callsRepositoryProvider = Provider<CallsApi>((ref) {
  const storage = FlutterSecureStorage();
  return CallsRepository(
    DioClient.createChatDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
