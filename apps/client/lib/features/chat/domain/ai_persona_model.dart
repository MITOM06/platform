class AiPersonaModel {
  final String conversationId;
  final String name;
  final String? avatarUrl;
  final String tone;
  final String? systemPromptPrefix;

  const AiPersonaModel({
    required this.conversationId,
    required this.name,
    this.avatarUrl,
    required this.tone,
    this.systemPromptPrefix,
  });

  factory AiPersonaModel.fromJson(Map<String, dynamic> json) => AiPersonaModel(
        conversationId: json['conversationId'] as String,
        name: json['name'] as String? ?? 'PON AI',
        avatarUrl: json['avatarUrl'] as String?,
        tone: json['tone'] as String? ?? 'friendly',
        systemPromptPrefix: json['systemPromptPrefix'] as String?,
      );

  Map<String, dynamic> toRequestJson() => {
        if (name.isNotEmpty) 'name': name,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
        'tone': tone,
        if (systemPromptPrefix != null && systemPromptPrefix!.isNotEmpty)
          'systemPromptPrefix': systemPromptPrefix,
      };
}
