enum ContextTier { public, internal, confidential }

String? tierToCapability(ContextTier t) {
  switch (t) {
    case ContextTier.internal:
      return 'VIEW_INTERNAL_CONTEXT';
    case ContextTier.confidential:
      return 'VIEW_CONFIDENTIAL_CONTEXT';
    case ContextTier.public:
      return null;
  }
}

ContextTier tierFromCapability(String? cap) {
  if (cap == 'VIEW_CONFIDENTIAL_CONTEXT') return ContextTier.confidential;
  if (cap == 'VIEW_INTERNAL_CONTEXT') return ContextTier.internal;
  return ContextTier.public;
}

class AiUserContext {
  final String userId;
  final String jobTitle;
  final List<String> projects;
  final String style;
  final String preferences;

  const AiUserContext({
    required this.userId,
    required this.jobTitle,
    required this.projects,
    required this.style,
    required this.preferences,
  });

  factory AiUserContext.fromJson(Map<String, dynamic> j) => AiUserContext(
        userId: (j['userId'] ?? '') as String,
        jobTitle: (j['jobTitle'] ?? '') as String,
        projects:
            ((j['projects'] as List?) ?? const []).map((e) => e.toString()).toList(),
        style: (j['style'] ?? '') as String,
        preferences: (j['preferences'] ?? '') as String,
      );
}

class AiContextEntry {
  final String id;
  final String scope; // 'company' | 'department'
  final String? scopeId;
  final String label;
  final String text;
  final String? requiredCapability;

  const AiContextEntry({
    required this.id,
    required this.scope,
    required this.scopeId,
    required this.label,
    required this.text,
    required this.requiredCapability,
  });

  factory AiContextEntry.fromJson(Map<String, dynamic> j) => AiContextEntry(
        id: (j['_id'] ?? j['id'] ?? '') as String,
        scope: (j['scope'] ?? 'company') as String,
        scopeId: j['scopeId'] as String?,
        label: (j['label'] ?? '') as String,
        text: (j['text'] ?? '') as String,
        requiredCapability: j['requiredCapability'] as String?,
      );
}

class MyAiContext {
  final AiUserContext context;
  final String? role;
  final List<String> departmentNames;
  final List<AiContextEntry> entries;

  const MyAiContext({
    required this.context,
    required this.role,
    required this.departmentNames,
    required this.entries,
  });

  factory MyAiContext.fromJson(Map<String, dynamic> j) {
    final identity = (j['identity'] as Map?)?.cast<String, dynamic>() ?? const {};
    return MyAiContext(
      context: AiUserContext.fromJson(
        (j['context'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      role: identity['role'] as String?,
      departmentNames: ((identity['departmentNames'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(),
      entries: ((j['entries'] as List?) ?? const [])
          .map((e) => AiContextEntry.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
    );
  }
}
