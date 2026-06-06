class AiMemoryModel {
  final String conversationId;
  final String summary;
  final List<String> keyFacts;
  final int messageCount;
  final DateTime updatedAt;

  const AiMemoryModel({
    required this.conversationId,
    required this.summary,
    required this.keyFacts,
    required this.messageCount,
    required this.updatedAt,
  });

  factory AiMemoryModel.fromJson(Map<String, dynamic> json) {
    return AiMemoryModel(
      conversationId: json['conversationId'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      keyFacts: (json['keyFacts'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      messageCount: json['messageCount'] as int? ?? 0,
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : DateTime.now(),
    );
  }
}
