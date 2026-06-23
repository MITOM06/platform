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

  /// `GET /connections` — this user's current connections. The backend derives
  /// identity from the JWT (attached by [connectorDio]); no userId is sent.
  Future<List<ConnectionView>> connections() async {
    final response = await _dio.get('/connections');
    final data = response.data as List<dynamic>;
    return data
        .map((e) => ConnectionView.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `GET /oauth/:provider/start` — returns the authorize URL to open in the
  /// system browser. Identity comes from the JWT; the backend redirects back
  /// on success.
  Future<String> startOAuth(String provider) async {
    final response = await _dio.get('/oauth/$provider/start');
    final data = response.data as Map<String, dynamic>;
    return data['authorizeUrl'] as String;
  }

  /// `DELETE /connections/:id`.
  Future<void> disconnect(String connectionId) async {
    await _dio.delete('/connections/$connectionId');
  }

  /// `GET /connections/:id/permissions` — the AI action groups granted to this
  /// connection (subset of `['view','create','edit','delete']`).
  Future<List<String>> getConnectionPermissions(String connectionId) async {
    final response = await _dio.get('/connections/$connectionId/permissions');
    final data = response.data as Map<String, dynamic>;
    return (data['actionGroups'] as List<dynamic>? ?? const [])
        .map((e) => e as String)
        .toList();
  }

  /// `PUT /connections/:id/permissions` — update the AI action groups. Returns
  /// the persisted set echoed back by the server.
  Future<List<String>> updateConnectionPermissions(
    String connectionId,
    List<String> actionGroups,
  ) async {
    final response = await _dio.put(
      '/connections/$connectionId/permissions',
      data: {'actionGroups': actionGroups},
    );
    final data = response.data as Map<String, dynamic>;
    return (data['actionGroups'] as List<dynamic>? ?? const [])
        .map((e) => e as String)
        .toList();
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

  // ── MCP Directory ───────────────────────────────────────────────────────

  /// `GET /directory` — available directory entries (DB-driven, no secrets).
  Future<List<DirectoryEntry>> directory() async {
    final response = await _dio.get('/directory');
    final data = response.data as List<dynamic>;
    return data
        .map((e) => DirectoryEntry.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `GET /oauth/directory/:slug/start` — begins a directory connect. Returns a
  /// result whose mode is 'oauth' (open [authorizeUrl] in the browser),
  /// 'apikey' (prompt for a key), or 'none' (already connected).
  Future<DirectoryStartResult> startDirectoryOAuth(String slug) async {
    final response = await _dio.get('/oauth/directory/$slug/start');
    return DirectoryStartResult.fromJson(response.data as Map<String, dynamic>);
  }

  /// `POST /oauth/directory/:slug/connect-key` — connect an apikey entry.
  Future<void> connectDirectoryKey(String slug, String credential) async {
    await _dio.post('/oauth/directory/$slug/connect-key', data: {
      'credential': credential,
    });
  }

  /// `POST /directory` — create a custom directory entry (admin only).
  Future<void> createDirectoryEntry(Map<String, dynamic> body) async {
    await _dio.post('/directory', data: body);
  }

  /// `PATCH /directory/:id` — update a directory entry (admin only).
  Future<void> updateDirectoryEntry(
    String id,
    Map<String, dynamic> body,
  ) async {
    await _dio.patch('/directory/$id', data: body);
  }

  /// `DELETE /directory/:id` — delete a custom directory entry (admin only).
  Future<void> deleteDirectoryEntry(String id) async {
    await _dio.delete('/directory/$id');
  }

  /// `GET /skills` — persisted skill toggles for this user (identity from JWT).
  Future<List<UserSkillState>> getSkills() async {
    final response = await _dio.get('/skills');
    final data = response.data as List<dynamic>;
    return data
        .map((e) => UserSkillState.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// `PUT /skills` — toggle a skill on/off (identity from JWT).
  Future<void> setSkill({
    required String skillId,
    required bool enabled,
  }) async {
    await _dio.put('/skills', data: {
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
