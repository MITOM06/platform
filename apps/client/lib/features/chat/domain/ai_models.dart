import 'package:flutter/foundation.dart';

const kAiBotUserId = 'ai-bot-000000000000000000000001';
const kAiErrorSentinel = '__AI_ERROR__';
const kAiQuotaExceededSentinel = '__AI_QUOTA__';
const kAiStreamInterruptedSentinel = '__AI_INTERRUPTED__';
const kAiUnavailableSentinel = '__AI_UNAVAILABLE__';
const kAiRateLimitedSentinel = '__AI_RATE_LIMITED__';

// Stable error codes emitted by ai-service (additive — keep in sync with AiStreamErrorCode).
const kAiErrCodeQuotaExceeded = 'AI_QUOTA_EXCEEDED';
const kAiErrCodeStreamInterrupted = 'AI_STREAM_INTERRUPTED';
const kAiErrCodeUnavailable = 'AI_UNAVAILABLE';
const kAiErrCodeRateLimited = 'AI_RATE_LIMITED';

@immutable
class ToolCallEntry {
  final String toolName;
  final String inputSummary;
  final String resultSummary;

  const ToolCallEntry({
    required this.toolName,
    required this.inputSummary,
    required this.resultSummary,
  });

  factory ToolCallEntry.fromJson(Map<String, dynamic> json) => ToolCallEntry(
        toolName: json['toolName'] as String? ?? '',
        inputSummary: json['inputSummary'] as String? ?? '',
        resultSummary: json['resultSummary'] as String? ?? '',
      );
}

@immutable
class AiTrace {
  final List<String> thinkingBlocks;
  final List<ToolCallEntry> toolCalls;
  final int inputTokens;
  final int outputTokens;
  final int thinkingTokens;
  final int processingMs;
  final String model;
  final int iterationCount;

  const AiTrace({
    required this.thinkingBlocks,
    required this.toolCalls,
    required this.inputTokens,
    required this.outputTokens,
    required this.thinkingTokens,
    required this.processingMs,
    required this.model,
    required this.iterationCount,
  });

  factory AiTrace.fromJson(Map<String, dynamic> json) => AiTrace(
        thinkingBlocks: List<String>.from(json['thinkingBlocks'] as List? ?? []),
        toolCalls: (json['toolCalls'] as List? ?? [])
            .map((e) => ToolCallEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        inputTokens: (json['inputTokens'] as num?)?.toInt() ?? 0,
        outputTokens: (json['outputTokens'] as num?)?.toInt() ?? 0,
        thinkingTokens: (json['thinkingTokens'] as num?)?.toInt() ?? 0,
        processingMs: (json['processingMs'] as num?)?.toInt() ?? 0,
        model: json['model'] as String? ?? '',
        iterationCount: (json['iterationCount'] as num?)?.toInt() ?? 0,
      );
}

/// A single RAG citation source returned in the AI_STREAM_DONE payload.
/// Backend now sends `{documentId, fileName, score}` objects; older payloads
/// (and persisted history) may carry a bare documentId string — both parse here.
@immutable
class AiSource {
  final String documentId;
  final String fileName;
  final double? score;

  /// Present only for web-search sources (TASK-09): the result URL the chip
  /// opens externally. Null/empty for KB sources.
  final String? url;

  /// Source kind — `'kb'` (knowledge-base doc, default) or `'web'`
  /// (web-search result). Defaults to `'kb'` when the backend omits it
  /// (backward compatible with pre-TASK-09 payloads).
  final String type;

  const AiSource({
    required this.documentId,
    this.fileName = '',
    this.score,
    this.url,
    this.type = 'kb',
  });

  /// Whether this source is a web-search result that should open externally.
  bool get isWeb => type == 'web' || (url != null && url!.isNotEmpty);

  /// Parses an entry that may be either a
  /// `{documentId, fileName, score, url?, type?}` map or a bare documentId
  /// string (backward compatible). Returns null when no usable documentId can
  /// be extracted.
  static AiSource? tryParse(dynamic raw) {
    if (raw is String) {
      if (raw.isEmpty) return null;
      return AiSource(documentId: raw);
    }
    if (raw is Map) {
      final id = raw['documentId'] as String? ?? '';
      if (id.isEmpty) return null;
      final url = raw['url'] as String?;
      return AiSource(
        documentId: id,
        fileName: raw['fileName'] as String? ?? '',
        score: (raw['score'] as num?)?.toDouble(),
        url: (url != null && url.isNotEmpty) ? url : null,
        type: raw['type'] as String? ?? 'kb',
      );
    }
    return null;
  }
}
