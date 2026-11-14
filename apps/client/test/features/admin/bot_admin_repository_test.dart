// BotAdminRepository: token ops go to connector-service, the bot list to
// chat-service (two distinct Dio instances) + JSON parsing and providers.

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/admin/data/bot_admin_repository.dart';

import '../chat/data/recording_adapter.dart';

void main() {
  late RecordingAdapter connector;
  late RecordingAdapter chat;
  late BotAdminRepository repo;

  setUp(() {
    connector = RecordingAdapter();
    chat = RecordingAdapter();
    repo = BotAdminRepository(recordingDio(connector), recordingDio(chat));
  });

  test('issue posts user+bot to connector-service, returns the one-time token',
      () async {
    connector.on('POST', '/api/bot/sessions',
        {'token': 'secret', 'mcpUrl': 'https://pon/mcp'});
    final t = await repo.issue('u1', 'b1');
    expect(connector.last.body, {'userId': 'u1', 'botUserId': 'b1'});
    expect(t.token, 'secret');
    expect(t.mcpUrl, 'https://pon/mcp');
    expect(chat.requests, isEmpty);
  });

  test('issue with a partial body defaults to empty strings', () async {
    connector.on('POST', '/api/bot/sessions', <String, dynamic>{});
    final t = await repo.issue('u1', 'b1');
    expect(t.token, '');
    expect(t.mcpUrl, '');
  });

  test('revoke sends DELETE with the pair in the body', () async {
    await repo.revoke('u1', 'b2');
    expect(connector.last.method, 'DELETE');
    expect(connector.last.path, '/api/bot/sessions');
    expect(connector.last.body, {'userId': 'u1', 'botUserId': 'b2'});
  });

  test('listSessions queries by owner and parses dates (blank → null)',
      () async {
    connector.on('GET', '/api/bot/sessions', {
      'sessions': [
        {
          'botUserId': 'b1',
          'createdAt': '2026-01-01T00:00:00Z',
          'lastUsedAt': ''
        },
        {'lastUsedAt': 'garbage'},
      ]
    });
    final s = await repo.listSessions('u9');
    expect(connector.last.query, {'userId': 'u9'});
    expect(s.length, 2);
    expect(s[0].botUserId, 'b1');
    expect(s[0].createdAt, DateTime.utc(2026));
    expect(s[0].lastUsedAt, isNull);
    expect(s[1].botUserId, '');
    expect(s[1].lastUsedAt, isNull);

    connector.on('GET', '/api/bot/sessions', <String, dynamic>{});
    expect(await repo.listSessions('u9'), isEmpty);
  });

  test('listExternalBots reads chat-service; _id fallback; non-list → []',
      () async {
    chat.on('GET', '/api/admin/external-bots', [
      {
        'id': 'x1',
        'botUserId': 'b1',
        'factoryBotId': 'f1',
        'ownerUserId': 'u1',
        'name': 'Helper',
        'avatarUrl': 'a.png',
        'enabled': false,
      },
      {'_id': 'x2'},
    ]);
    final bots = await repo.listExternalBots();
    expect(connector.requests, isEmpty);
    expect(bots[0].id, 'x1');
    expect(bots[0].factoryBotId, 'f1');
    expect(bots[0].enabled, isFalse);
    expect(bots[0].avatarUrl, 'a.png');
    expect(bots[1].id, 'x2');
    expect(bots[1].name, '');
    expect(bots[1].enabled, isTrue);

    chat.on('GET', '/api/admin/external-bots', {'error': 'x'});
    expect(await repo.listExternalBots(), isEmpty);
  });

  test('403 from the admin gate propagates', () async {
    chat.on('GET', '/api/admin/external-bots', {'code': 'INSUFFICIENT_PERMISSION'},
        status: 403);
    await expectLater(repo.listExternalBots(), throwsA(isA<DioException>()));
  });

  test('providers read through the repository', () async {
    chat.on('GET', '/api/admin/external-bots', [
      {'id': 'x1', 'name': 'A'}
    ]);
    connector.on('GET', '/api/bot/sessions', {
      'sessions': [
        {'botUserId': 'b7'}
      ]
    });
    final c = ProviderContainer(
        overrides: [botAdminRepositoryProvider.overrideWithValue(repo)]);
    addTearDown(c.dispose);
    expect((await c.read(externalBotsProvider.future)).single.name, 'A');
    expect(
        (await c.read(botSessionsProvider('u3').future)).single.botUserId, 'b7');
    expect(connector.last.query, {'userId': 'u3'});
  });
}
