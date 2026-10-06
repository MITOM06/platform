class AiPersonaModel {
  final String conversationId;

  /// Null when no name was set — the workspace AI name applies.
  final String? name;
  final String? avatarUrl;
  final String tone;
  final String? systemPromptPrefix;

  const AiPersonaModel({
    required this.conversationId,
    this.name,
    this.avatarUrl,
    required this.tone,
    this.systemPromptPrefix,
  });

  factory AiPersonaModel.fromJson(Map<String, dynamic> json) => AiPersonaModel(
        conversationId: json['conversationId'] as String,
        name: (json['name'] as String?)?.trim().isEmpty ?? true
            ? null
            : json['name'] as String,
        avatarUrl: json['avatarUrl'] as String?,
        tone: json['tone'] as String? ?? 'friendly',
        systemPromptPrefix: json['systemPromptPrefix'] as String?,
      );

  Map<String, dynamic> toRequestJson() => {
        if (name != null && name!.isNotEmpty) 'name': name,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
        'tone': tone,
        if (systemPromptPrefix != null && systemPromptPrefix!.isNotEmpty)
          'systemPromptPrefix': systemPromptPrefix,
      };
}
