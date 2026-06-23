// Dart models mirroring the ai-service `GET /usage/dashboard` response
// (`DashboardResponse`). Parsing is defensive: every numeric field defaults to
// 0, every list defaults to empty, nullable strings stay nullable — so a sparse
// or empty payload never throws and the panel renders a clean empty state.

int _asInt(dynamic v) => (v as num?)?.toInt() ?? 0;
double _asDouble(dynamic v) => (v as num?)?.toDouble() ?? 0.0;
String? _asStr(dynamic v) => v is String ? v : null;

class UsageRange {
  final String? from;
  final String? to;
  final String? label;

  const UsageRange({this.from, this.to, this.label});

  factory UsageRange.fromJson(Map<String, dynamic> j) => UsageRange(
        from: _asStr(j['from']),
        to: _asStr(j['to']),
        label: _asStr(j['label']),
      );
}

class UsageTotals {
  final int inputTokens;
  final int outputTokens;
  final int totalTokens;
  final int requestCount;
  final double estimatedCostUsd;

  const UsageTotals({
    required this.inputTokens,
    required this.outputTokens,
    required this.totalTokens,
    required this.requestCount,
    required this.estimatedCostUsd,
  });

  factory UsageTotals.fromJson(Map<String, dynamic> j) => UsageTotals(
        inputTokens: _asInt(j['inputTokens']),
        outputTokens: _asInt(j['outputTokens']),
        totalTokens: _asInt(j['totalTokens']),
        requestCount: _asInt(j['requestCount']),
        estimatedCostUsd: _asDouble(j['estimatedCostUsd']),
      );

  static const empty = UsageTotals(
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requestCount: 0,
    estimatedCostUsd: 0,
  );
}

class PerModelCost {
  final String model;
  final int inputTokens;
  final int outputTokens;
  final int requestCount;
  final double inputPricePerMTok;
  final double outputPricePerMTok;
  final double costUsd;

  const PerModelCost({
    required this.model,
    required this.inputTokens,
    required this.outputTokens,
    required this.requestCount,
    required this.inputPricePerMTok,
    required this.outputPricePerMTok,
    required this.costUsd,
  });

  factory PerModelCost.fromJson(Map<String, dynamic> j) => PerModelCost(
        model: _asStr(j['model']) ?? '—',
        inputTokens: _asInt(j['inputTokens']),
        outputTokens: _asInt(j['outputTokens']),
        requestCount: _asInt(j['requestCount']),
        inputPricePerMTok: _asDouble(j['inputPricePerMTok']),
        outputPricePerMTok: _asDouble(j['outputPricePerMTok']),
        costUsd: _asDouble(j['costUsd']),
      );
}

class TopUser {
  final String userId;
  final String? displayName;
  final int totalTokens;
  final int requestCount;
  final double estimatedCostUsd;

  const TopUser({
    required this.userId,
    this.displayName,
    required this.totalTokens,
    required this.requestCount,
    required this.estimatedCostUsd,
  });

  factory TopUser.fromJson(Map<String, dynamic> j) => TopUser(
        userId: _asStr(j['userId']) ?? '',
        displayName: _asStr(j['displayName']),
        totalTokens: _asInt(j['totalTokens']),
        requestCount: _asInt(j['requestCount']),
        estimatedCostUsd: _asDouble(j['estimatedCostUsd']),
      );

  /// Best-effort label: backend resolves displayName, falls back to userId.
  String get label =>
      (displayName != null && displayName!.trim().isNotEmpty)
          ? displayName!
          : userId;
}

class WorstAnswer {
  final String messageId;
  final String? conversationId;
  final String? comment;
  final String? answerPreview;
  final String? createdAt;

  const WorstAnswer({
    required this.messageId,
    this.conversationId,
    this.comment,
    this.answerPreview,
    this.createdAt,
  });

  factory WorstAnswer.fromJson(Map<String, dynamic> j) => WorstAnswer(
        messageId: _asStr(j['messageId']) ?? '',
        conversationId: _asStr(j['conversationId']),
        comment: _asStr(j['comment']),
        answerPreview: _asStr(j['answerPreview']),
        createdAt: _asStr(j['createdAt']),
      );
}

class UsageFeedback {
  final int up;
  final int down;
  final int total;
  final double thumbsDownRate; // 0..1
  final List<WorstAnswer> worstAnswers;

  const UsageFeedback({
    required this.up,
    required this.down,
    required this.total,
    required this.thumbsDownRate,
    required this.worstAnswers,
  });

  factory UsageFeedback.fromJson(Map<String, dynamic> j) => UsageFeedback(
        up: _asInt(j['up']),
        down: _asInt(j['down']),
        total: _asInt(j['total']),
        thumbsDownRate: _asDouble(j['thumbsDownRate']),
        worstAnswers: (j['worstAnswers'] as List<dynamic>? ?? const [])
            .map((e) => WorstAnswer.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  static const empty = UsageFeedback(
    up: 0,
    down: 0,
    total: 0,
    thumbsDownRate: 0,
    worstAnswers: [],
  );
}

/// Full payload of `GET /usage/dashboard`.
class UsageDashboard {
  final UsageRange range;
  final UsageTotals totals;
  final List<PerModelCost> perModelCost;
  final List<TopUser> topUsers;
  final UsageFeedback feedback;

  const UsageDashboard({
    required this.range,
    required this.totals,
    required this.perModelCost,
    required this.topUsers,
    required this.feedback,
  });

  factory UsageDashboard.fromJson(Map<String, dynamic> j) => UsageDashboard(
        range: UsageRange.fromJson(
            (j['range'] as Map<String, dynamic>?) ?? const {}),
        totals: UsageTotals.fromJson(
            (j['totals'] as Map<String, dynamic>?) ?? const {}),
        perModelCost: (j['perModelCost'] as List<dynamic>? ?? const [])
            .map((e) => PerModelCost.fromJson(e as Map<String, dynamic>))
            .toList(),
        topUsers: (j['topUsers'] as List<dynamic>? ?? const [])
            .map((e) => TopUser.fromJson(e as Map<String, dynamic>))
            .toList(),
        feedback: UsageFeedback.fromJson(
            (j['feedback'] as Map<String, dynamic>?) ?? const {}),
      );
}
