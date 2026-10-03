import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';

// ── Quota / pricing config ──────────────────────────────────────────────────
// Anthropic Claude per-token prices (USD) and the monthly token allowance.
// Kept in one place so the numbers aren't scattered across the UI.
const int kMonthlyTokenQuota = 500000;
const double kInputTokenPrice = 0.000003;
const double kOutputTokenPrice = 0.000015;

// ── Model ─────────────────────────────────────────────────────────────────────

class TokenUsageDay {
  final String date;
  final int inputTokens;
  final int outputTokens;
  final int requestCount;
  final int totalTokens;

  const TokenUsageDay({
    required this.date,
    required this.inputTokens,
    required this.outputTokens,
    required this.requestCount,
    required this.totalTokens,
  });

  factory TokenUsageDay.fromJson(Map<String, dynamic> json) => TokenUsageDay(
        date: json['date'] as String,
        inputTokens: (json['inputTokens'] as num?)?.toInt() ?? 0,
        outputTokens: (json['outputTokens'] as num?)?.toInt() ?? 0,
        requestCount: (json['requestCount'] as num?)?.toInt() ?? 0,
        totalTokens: (json['totalTokens'] as num?)?.toInt() ?? 0,
      );
}

// ── Provider ──────────────────────────────────────────────────────────────────

/// Shared chat-service Dio, built once and reused across token-usage fetches
/// (was previously rebuilt on every request, leaking interceptors).
final _chatDioProvider = Provider<Dio>((ref) {
  const storage = FlutterSecureStorage();
  return DioClient.createChatDio(
    storage,
    onForceLogout: () => ref.read(authNotifierProvider.notifier).forceLogout(),
  );
});

/// Query params for the token-usage endpoint. Use [days] for the "last N days"
/// preset mode, or [startDate]/[endDate] (ISO yyyy-MM-dd) for a custom range.
typedef TokenUsageQuery = ({int? days, String? startDate, String? endDate});

final tokenUsageProvider = FutureProvider.autoDispose
    .family<List<TokenUsageDay>, TokenUsageQuery>((ref, query) async {
  final dio = ref.read(_chatDioProvider);
  final queryParams = <String, dynamic>{};
  if (query.days != null) queryParams['days'] = query.days;
  if (query.startDate != null) queryParams['startDate'] = query.startDate;
  if (query.endDate != null) queryParams['endDate'] = query.endDate;

  final response = await dio.get<List<dynamic>>(
    '/api/usage/tokens',
    queryParameters: queryParams,
  );
  return (response.data ?? [])
      .map((e) => TokenUsageDay.fromJson(e as Map<String, dynamic>))
      .toList();
});
