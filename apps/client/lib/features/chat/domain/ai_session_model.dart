/// Domain model for an AI conversation session (ai-service `ai_sessions`).
///
/// Mirrors the web `AiSession` shape. The backend returns Mongo `_id`; we map
/// it to [id]. A conversation (chat-service) can own many sessions; exactly one
/// is [isActive] at a time.
class AiSessionModel {
  final String id;
  final String name;
  final bool isActive;
  final int totalTokens;
  final String? summary;
  final DateTime createdAt;
  final DateTime updatedAt;

  const AiSessionModel({
    required this.id,
    required this.name,
    required this.isActive,
    required this.totalTokens,
    required this.summary,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get hasSummary => summary != null && summary!.trim().isNotEmpty;

  factory AiSessionModel.fromJson(Map<String, dynamic> json) {
    final rawSummary = json['summary'] as String?;
    return AiSessionModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      name: (json['name'] as String?)?.trim().isNotEmpty == true
          ? json['name'] as String
          : 'New conversation',
      isActive: json['isActive'] as bool? ?? false,
      totalTokens: (json['totalTokens'] as num?)?.toInt() ?? 0,
      summary: (rawSummary != null && rawSummary.trim().isNotEmpty)
          ? rawSummary
          : null,
      createdAt: _parseDate(json['createdAt']),
      updatedAt: _parseDate(json['updatedAt']),
    );
  }

  static DateTime _parseDate(dynamic value) {
    if (value is String && value.isNotEmpty) {
      return DateTime.tryParse(value)?.toLocal() ?? DateTime.now();
    }
    return DateTime.now();
  }
}
