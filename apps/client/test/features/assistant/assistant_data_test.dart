import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/assistant/data/assistant_error.dart';
import 'package:platform_client/features/assistant/data/assistant_repository.dart';
import 'package:platform_client/features/assistant/state/assistant_provider.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import '../integrations/route_adapter.dart';

final _en = lookupAppLocalizations(const Locale('en'));

DioException _err(int status, Object? body) => DioException(
      requestOptions: RequestOptions(path: '/api/assistant/setup'),
      type: DioExceptionType.badResponse,
      response: Response(
          requestOptions: RequestOptions(path: '/x'),
          statusCode: status,
          data: body),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AssistantRepository', () {
    test('fetchAssistant: 404 → null (not registered), other errors rethrow',
        () async {
      final a = RouteAdapter({
        'GET /api/assistant/me': const Reply(404, {'code': 'NOT_FOUND'}),
      });
      final repo = AssistantRepository(dioWith(a));
      expect(await repo.fetchAssistant(), isNull);

      a.routes['GET /api/assistant/me'] =
          const Reply(502, {'code': 'ASSISTANT_UPSTREAM_FAILED'});
      await expectLater(repo.fetchAssistant(), throwsA(isA<DioException>()));

      a.routes['GET /api/assistant/me'] = const Reply(200, {
        'botUserId': 'b1',
        'name': 'Max',
        'systemPrompt': 'Be brief',
        'providerId': 'claude',
      });
      final info = (await repo.fetchAssistant())!;
      expect(info.botUserId, 'b1');
      expect(info.systemPrompt, 'Be brief');
      expect(info.avatarUrl, isNull);
    });

    test('providers: list parsed; null body → []', () async {
      final a = RouteAdapter({
        'GET /api/assistant/providers': const Reply(200, [
          {'id': 'p', 'label': 'Claude', 'provider': 'anthropic', 'model': 'm'}
        ]),
      });
      final repo = AssistantRepository(dioWith(a));
      expect((await repo.fetchProviders()).single.label, 'Claude');
      a.routes['GET /api/assistant/providers'] = const Reply(200);
      expect(await repo.fetchProviders(), isEmpty);
    });

    test('setup trims and omits blank persona / model; delete', () async {
      final a = RouteAdapter({
        'POST /api/assistant/setup':
            const Reply(200, {'botUserId': 'b1', 'name': 'Max'}),
        'DELETE /api/assistant/setup': const Reply(204),
      });
      final repo = AssistantRepository(dioWith(a));
      final info =
          await repo.setup(name: '  Max ', systemPrompt: '   ', providerId: null);
      expect(a.requests.single.data, {'name': 'Max'});
      expect(info.name, 'Max');
      expect(info.avatarUrl, isNull);

      await repo.setup(name: 'Max', systemPrompt: ' Hi ', providerId: ' p ');
      expect(a.requests.last.data,
          {'name': 'Max', 'systemPrompt': 'Hi', 'providerId': 'p'});

      await repo.deleteAssistant();
      expect(a.calls('DELETE', '/api/assistant/setup'), hasLength(1));
    });
  });

  group('providers', () {
    test('assistantProvider + assistantProvidersProvider', () async {
      final a = RouteAdapter({
        'GET /api/assistant/me': const Reply(404, {}),
        'GET /api/assistant/providers': const Reply(200, []),
      });
      final c = ProviderContainer(overrides: [
        assistantRepositoryProvider
            .overrideWithValue(AssistantRepository(dioWith(a))),
      ]);
      addTearDown(c.dispose);
      expect(await c.read(assistantProvider.future), isNull);
      expect(await c.read(assistantProvidersProvider.future), isEmpty);
    });
  });

  group('assistantErrorMessage never shows raw server text', () {
    test('assistant codes map to their own message', () {
      expect(
          assistantErrorMessage(
              _en, _err(400, {'code': 'ASSISTANT_SETUP_INCOMPLETE'})),
          _en.errAssistantSetupIncomplete);
      expect(
          assistantErrorMessage(
              _en, _err(503, {'code': 'ASSISTANT_NOT_CONFIGURED'})),
          _en.errAssistantNotConfigured);
      expect(
          assistantErrorMessage(
              _en, _err(502, {'code': 'ASSISTANT_UPSTREAM_FAILED'})),
          _en.errAssistantUpstreamFailed);
    });

    test('anything else falls back to a localized, non-raw message', () {
      final msg = assistantErrorMessage(_en,
          _err(500, {'message': 'MongoServerError: E11000 dup key at bots'}));
      expect(msg, isNotEmpty);
      expect(msg.contains('Mongo'), isFalse);
      expect(msg.contains('E11000'), isFalse);
      expect(assistantErrorMessage(_en, StateError('boom')).contains('boom'),
          isFalse);
    });
  });
}
