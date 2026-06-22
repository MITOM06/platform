import 'package:flutter/foundation.dart';

/// Auth mechanism a connector / custom MCP server uses.
enum ConnectorAuthType { oauth2, apikey, none }

ConnectorAuthType _authTypeFromString(String? raw) {
  switch (raw) {
    case 'oauth2':
      return ConnectorAuthType.oauth2;
    case 'apikey':
      return ConnectorAuthType.apikey;
    case 'none':
    default:
      return ConnectorAuthType.none;
  }
}

String connectorAuthTypeToString(ConnectorAuthType type) {
  switch (type) {
    case ConnectorAuthType.oauth2:
      return 'oauth2';
    case ConnectorAuthType.apikey:
      return 'apikey';
    case ConnectorAuthType.none:
      return 'none';
  }
}

/// Connection lifecycle state returned by `GET /connections`.
enum ConnectionStatus { active, expired, revoked }

ConnectionStatus _statusFromString(String? raw) {
  switch (raw) {
    case 'active':
      return ConnectionStatus.active;
    case 'expired':
      return ConnectionStatus.expired;
    case 'revoked':
      return ConnectionStatus.revoked;
    default:
      return ConnectionStatus.revoked;
  }
}

/// One catalog entry from `GET /catalog`.
@immutable
class CatalogEntry {
  final String id;
  final String name;
  final String icon;
  final String description;
  final List<String> scopes;
  final ConnectorAuthType authType;
  final String mcpUrl;
  final bool available;

  const CatalogEntry({
    required this.id,
    required this.name,
    required this.icon,
    required this.description,
    required this.scopes,
    required this.authType,
    required this.mcpUrl,
    required this.available,
  });

  factory CatalogEntry.fromJson(Map<String, dynamic> json) => CatalogEntry(
        id: json['id'] as String,
        name: json['name'] as String? ?? '',
        icon: json['icon'] as String? ?? '🔌',
        description: json['description'] as String? ?? '',
        scopes: (json['scopes'] as List<dynamic>? ?? const [])
            .map((e) => e as String)
            .toList(),
        authType: _authTypeFromString(json['authType'] as String?),
        mcpUrl: json['mcpUrl'] as String? ?? '',
        available: json['available'] as bool? ?? false,
      );
}

/// One active/expired/revoked connection from `GET /connections`.
@immutable
class ConnectionView {
  final String id;
  final String provider;
  final ConnectionStatus status;
  final List<String> scopes;
  final String? accountLabel;
  final DateTime? lastUsedAt;

  const ConnectionView({
    required this.id,
    required this.provider,
    required this.status,
    required this.scopes,
    required this.accountLabel,
    required this.lastUsedAt,
  });

  factory ConnectionView.fromJson(Map<String, dynamic> json) => ConnectionView(
        id: json['id'] as String? ?? json['_id'] as String,
        provider: json['provider'] as String,
        status: _statusFromString(json['status'] as String?),
        scopes: (json['scopes'] as List<dynamic>? ?? const [])
            .map((e) => e as String)
            .toList(),
        accountLabel: json['accountLabel'] as String?,
        lastUsedAt: json['lastUsedAt'] == null
            ? null
            : DateTime.tryParse(json['lastUsedAt'].toString()),
      );

  bool get isActive => status == ConnectionStatus.active;
}

/// A tool preview returned by `POST /custom-mcp/discover`.
@immutable
class McpToolPreview {
  final String name;
  final String description;

  const McpToolPreview({required this.name, required this.description});

  factory McpToolPreview.fromJson(Map<String, dynamic> json) => McpToolPreview(
        name: json['name'] as String? ?? '',
        description: json['description'] as String? ?? '',
      );
}

/// A connector catalog entry paired with its current connection (if any).
@immutable
class ConnectorItem {
  final CatalogEntry entry;
  final ConnectionView? connection;

  const ConnectorItem({required this.entry, this.connection});

  bool get isConnected => connection?.isActive ?? false;
}

// ── MCP Directory (dynamic connector directory) ─────────────────────────────

/// How a directory entry authenticates a connection.
enum DirectoryAuthMode { mcpOauth, envOauth, apikey, none }

DirectoryAuthMode directoryAuthModeFromString(String? raw) {
  switch (raw) {
    case 'mcp-oauth':
      return DirectoryAuthMode.mcpOauth;
    case 'env-oauth':
      return DirectoryAuthMode.envOauth;
    case 'apikey':
      return DirectoryAuthMode.apikey;
    case 'none':
    default:
      return DirectoryAuthMode.none;
  }
}

String directoryAuthModeToString(DirectoryAuthMode mode) {
  switch (mode) {
    case DirectoryAuthMode.mcpOauth:
      return 'mcp-oauth';
    case DirectoryAuthMode.envOauth:
      return 'env-oauth';
    case DirectoryAuthMode.apikey:
      return 'apikey';
    case DirectoryAuthMode.none:
      return 'none';
  }
}

/// Governance tier of a directory entry.
enum DirectoryTier { workspace, personal, both }

DirectoryTier directoryTierFromString(String? raw) {
  switch (raw) {
    case 'workspace':
      return DirectoryTier.workspace;
    case 'personal':
      return DirectoryTier.personal;
    case 'both':
    default:
      return DirectoryTier.both;
  }
}

String directoryTierToString(DirectoryTier tier) {
  switch (tier) {
    case DirectoryTier.workspace:
      return 'workspace';
    case DirectoryTier.personal:
      return 'personal';
    case DirectoryTier.both:
      return 'both';
  }
}

/// One entry from `GET /directory` — a discoverable MCP server.
@immutable
class DirectoryEntry {
  final String id;
  final String slug;
  final String name;
  final String icon;
  final String description;
  final String mcpUrl;
  final DirectoryAuthMode authMode;
  final DirectoryTier tier;
  final List<String> scopes;
  final bool available;
  final bool builtin;

  const DirectoryEntry({
    required this.id,
    required this.slug,
    required this.name,
    required this.icon,
    required this.description,
    required this.mcpUrl,
    required this.authMode,
    required this.tier,
    required this.scopes,
    required this.available,
    required this.builtin,
  });

  factory DirectoryEntry.fromJson(Map<String, dynamic> json) => DirectoryEntry(
        id: json['id'] as String? ?? json['_id'] as String,
        slug: json['slug'] as String,
        name: json['name'] as String? ?? '',
        icon: json['icon'] as String? ?? '',
        description: json['description'] as String? ?? '',
        mcpUrl: json['mcpUrl'] as String? ?? '',
        authMode: directoryAuthModeFromString(json['authMode'] as String?),
        tier: directoryTierFromString(json['tier'] as String?),
        scopes: (json['scopes'] as List<dynamic>? ?? const [])
            .map((e) => e as String)
            .toList(),
        available: json['available'] as bool? ?? true,
        builtin: json['builtin'] as bool? ?? false,
      );
}

/// A directory entry paired with its current connection (if any).
@immutable
class DirectoryItem {
  final DirectoryEntry entry;
  final ConnectionView? connection;

  const DirectoryItem({required this.entry, this.connection});

  bool get isConnected => connection?.isActive ?? false;
}

/// Result of `GET /oauth/directory/:slug/start` — varies by auth mode.
@immutable
class DirectoryStartResult {
  /// 'oauth' | 'apikey' | 'none'.
  final String mode;

  /// Set only when [mode] is 'oauth'.
  final String? authorizeUrl;

  const DirectoryStartResult({required this.mode, this.authorizeUrl});

  factory DirectoryStartResult.fromJson(Map<String, dynamic> json) =>
      DirectoryStartResult(
        mode: json['mode'] as String? ?? 'oauth',
        authorizeUrl: json['authorizeUrl'] as String?,
      );
}

/// One persisted skill toggle from `GET /skills`.
@immutable
class UserSkillState {
  final String skillId;
  final bool enabled;

  const UserSkillState({required this.skillId, required this.enabled});

  factory UserSkillState.fromJson(Map<String, dynamic> json) => UserSkillState(
        skillId: json['skillId'] as String,
        enabled: json['enabled'] as bool? ?? false,
      );
}
