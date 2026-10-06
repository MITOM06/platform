import 'package:flutter/foundation.dart';

/// One of the caller's custom MCP servers (`GET /custom-mcp`). Secret-free:
/// the credential is never returned and [url] is display-redacted by the
/// server (custom MCP URLs often embed an API key).
@immutable
class CustomMcpServer {
  final String id;
  final String name;
  final String url;
  final bool hasCredential;
  final int toolCount;
  final DateTime? createdAt;

  const CustomMcpServer({
    required this.id,
    required this.name,
    required this.url,
    this.hasCredential = false,
    this.toolCount = 0,
    this.createdAt,
  });

  /// Host only — the rest of a (redacted) URL is noise in a list row.
  String get host {
    final parsed = Uri.tryParse(url);
    return (parsed != null && parsed.host.isNotEmpty) ? parsed.host : '';
  }

  static CustomMcpServer? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final id = raw['id'] ?? raw['_id'];
    if (id is! String || id.isEmpty) return null;
    final tools = raw['toolsPreview'];
    final created = raw['createdAt'];
    return CustomMcpServer(
      id: id,
      name: raw['name'] is String ? raw['name'] as String : '',
      url: raw['url'] is String ? raw['url'] as String : '',
      hasCredential: raw['hasCredential'] == true,
      toolCount: tools is List ? tools.length : 0,
      createdAt: created is String ? DateTime.tryParse(created) : null,
    );
  }
}
