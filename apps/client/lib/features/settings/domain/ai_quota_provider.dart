import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';

/// The caller's AI token allowance for the current UTC month
/// (`GET /usage/quota` on ai-service). Replaces the old hardcoded 500k.
@immutable
class AiQuota {
  /// Tokens used this period (prompt + output, cache included).
  final int used;

  /// Monthly allowance. `0` = AI is blocked for this workspace.
  final int limit;

  /// First instant of the period (UTC).
  final DateTime? periodStart;

  /// First instant AFTER the period (exclusive, UTC).
  final DateTime? periodEnd;

  const AiQuota({
    required this.used,
    required this.limit,
    this.periodStart,
    this.periodEnd,
  });

  factory AiQuota.fromJson(Map<String, dynamic> json) {
    DateTime? date(Object? v) => v is String ? DateTime.tryParse(v) : null;
    int count(Object? v) => v is num ? v.toInt() : 0;
    return AiQuota(
      used: count(json['used']),
      limit: count(json['limit']),
      periodStart: date(json['periodStart']),
      periodEnd: date(json['periodEnd']),
    );
  }

  /// AI is switched off (limit 0).
  bool get blocked => limit <= 0;

  /// The allowance is used up (server rule: `used >= limit`).
  bool get exceeded => used >= limit;

  /// Used share, 0..1 (1 when blocked).
  double get fraction => limit <= 0 ? 1 : (used / limit).clamp(0.0, 1.0);

  /// Last day of the period (the exclusive end minus a day), for display.
  DateTime? get periodLastDay =>
      periodEnd?.subtract(const Duration(days: 1));
}

class AiQuotaRepository {
  final Dio _dio;
  const AiQuotaRepository(this._dio);

  Future<AiQuota> fetch() async {
    final res = await _dio.get('/usage/quota');
    final data = res.data;
    return AiQuota.fromJson(
        data is Map<String, dynamic> ? data : const <String, dynamic>{});
  }
}

final aiQuotaRepositoryProvider = Provider<AiQuotaRepository>((ref) {
  const storage = FlutterSecureStorage();
  return AiQuotaRepository(
    DioClient.createAiDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});

/// The caller's quota; re-fetched each time the usage screen opens.
final aiQuotaProvider = FutureProvider.autoDispose<AiQuota>((ref) {
  return ref.read(aiQuotaRepositoryProvider).fetch();
});
