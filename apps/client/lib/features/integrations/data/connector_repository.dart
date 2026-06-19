import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import 'models/connector_models.dart';

/// Talks to the connector-service (:3003) over [connectorDio]. All MCP /
/// integration REST endpoints live here — never call Dio from widgets.
class ConnectorRepository {
  final Dio _dio;

  const ConnectorRepository(this._dio);

  /// `GET /catalog` — available connectors (Notion, etc.).
  Future<List<CatalogEntry>> catalog() async {
    final response = await _dio.get('/catalog');
    final data = response.data as List<dynamic>;
    return data
        .map((e) => CatalogEntry.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `GET /connections?userId=` — this user's current connections.
  Future<List<ConnectionView>> connections(String userId) async {
    final response = await _dio.get(
      '/connections',
      queryParameters: {'userId': userId},
    );
    final data = response.data as List<dynamic>;
    return data
        .map((e) => ConnectionView.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `GET /oauth/:provider/start?userId=` — returns the authorize URL to open
  /// in the system browser. The backend redirects back on success.
  Future<String> startOAuth(String provider, String userId) async {
    final response = await _dio.get(
      '/oauth/$provider/start',
      queryParameters: {'userId': userId},
    );
    final data = response.data as Map<String, dynamic>;
    return data['authorizeUrl'] as String;
  }

  /// `DELETE /connections/:id`.
  Future<void> disconnect(String connectionId) async {
    await _dio.delete('/connections/$connectionId');
  }

  /// `POST /custom-mcp/discover` — preview a custom server's tools WITHOUT
  /// saving it.
  Future<List<McpToolPreview>> discoverCustom({
    required String url,
    required ConnectorAuthType authType,
    String? credential,
  }) async {
    final response = await _dio.post('/custom-mcp/discover', data: {
      'url': url,
      'authType': connectorAuthTypeToString(authType),
      if (credential != null && credential.isNotEmpty) 'credential': credential,
    });
    final data = response.data as Map<String, dynamic>;
    final tools = data['tools'] as List<dynamic>? ?? const [];
    return tools
        .map((e) => McpToolPreview.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `POST /custom-mcp` — persist a custom MCP server for this user.
  Future<void> saveCustom({
    required String name,
    required String url,
    required ConnectorAuthType authType,
    String? credential,
  }) async {
    await _dio.post('/custom-mcp', data: {
      'name': name,
      'url': url,
      'authType': connectorAuthTypeToString(authType),
      if (credential != null && credential.isNotEmpty) 'credential': credential,
    });
  }

  /// `GET /skills?userId=` — persisted skill toggles for this user.
  Future<List<UserSkillState>> getSkills(String userId) async {
    final response = await _dio.get(
      '/skills',
      queryParameters: {'userId': userId},
    );
    final data = response.data as List<dynamic>;
    return data
        .map((e) => UserSkillState.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `PUT /skills` — toggle a skill on/off.
  Future<void> setSkill({
    required String userId,
    required String skillId,
    required bool enabled,
  }) async {
    await _dio.put('/skills', data: {
      'userId': userId,
      'skillId': skillId,
      'enabled': enabled,
    });
  }
}

final connectorRepositoryProvider = Provider<ConnectorRepository>((ref) {
  const storage = FlutterSecureStorage();
  return ConnectorRepository(
    DioClient.createConnectorDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
