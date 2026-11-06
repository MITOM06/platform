import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/settings/domain/ai_quota_provider.dart';
import 'package:platform_client/features/settings/domain/token_usage_provider.dart';

import '../integrations/route_adapter.dart';

void main() {
  group('AiQuota', () {
    test('limit 0 = AI blocked: fraction full, exceeded', () {
      final q = AiQuota.fromJson(const {'used': 0, 'limit': 0});
      expect(q.blocked, isTrue);
      expect(q.exceeded, isTrue);
      expect(q.fraction, 1);
    });

    test('used == limit is exceeded (server rule), fraction clamps to 1', () {
      expect(AiQuota.fromJson(const {'used': 100, 'limit': 100}).exceeded, isTrue);
      expect(AiQuota.fromJson(const {'used': 99, 'limit': 100}).exceeded, isFalse);
      expect(AiQuota.fromJson(const {'used': 500, 'limit': 100}).fraction, 1.0);
      expect(AiQuota.fromJson(const {'used': 25, 'limit': 100}).fraction, 0.25);
    });

    test('non-numeric / missing fields → 0, bad dates → null', () {
      final q = AiQuota.fromJson(const {
        'used': '12',
        'limit': null,
        'periodStart': 5,
        'periodEnd': 'nope',
      });
      expect(q.used, 0);
      expect(q.limit, 0);
      expect(q.periodStart, isNull);
      expect(q.periodLastDay, isNull);
    });

    test('periodLastDay = exclusive end minus one day', () {
      final q = AiQuota.fromJson(const {
        'used': 1.9,
        'limit': 10,
        'periodEnd': '2026-12-01T00:00:00Z',
      });
      expect(q.used, 1);
      expect(q.periodLastDay, DateTime.utc(2026, 11, 30));
    });

    test('repository: non-map body becomes an empty (blocked) quota', () async {
      final a = RouteAdapter({'GET /usage/quota': const Reply(200, [1, 2])});
      final q = await AiQuotaRepository(dioWith(a)).fetch();
      expect(q.blocked, isTrue);

      a.routes['GET /usage/quota'] =
          const Reply(200, {'used': 10, 'limit': 1000});
      final c = ProviderContainer(overrides: [
        aiQuotaRepositoryProvider
            .overrideWithValue(AiQuotaRepository(dioWith(a))),
      ]);
      addTearDown(c.dispose);
      c.listen(aiQuotaProvider, (_, __) {});
      expect((await c.read(aiQuotaProvider.future)).fraction, 0.01);
    });
  });

  test('TokenUsageDay: missing counters default to 0', () {
    final d = TokenUsageDay.fromJson(
        const {'date': '2026-11-01', 'inputTokens': 3.0, 'totalTokens': null});
    expect(d.inputTokens, 3);
    expect(d.outputTokens, 0);
    expect(d.totalTokens, 0);
    expect(d.requestCount, 0);
  });
}
