// ChatRepositoryMessageOps: exact chat-service contract (method, path, query,
// body) + response parsing, and that HTTP errors propagate as DioException
// (callers map them to localized text — the repo never swallows them).

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/data/chat_repository.dart';

import 'recording_adapter.dart';

void main() {
  late RecordingAdapter http;
  late ChatRepository repo;

  setUp(() {
    http = RecordingAdapter();
    repo = ChatRepository(recordingDio(http));
  });

  group('history paging', () {
    test('newest page: no cursor, size sent, hasNext parsed', () async {
      http.on('GET', '/api/conversations/c1/messages', {
        'content': [messageJson('m2'), messageJson('m1')],
        'page': 0,
        'size': 20,
        'totalElements': 57,
        'hasNext': true,
      });
      final res = await repo.getMessages('c1');
      expect(http.last.query, {'size': 20});
      expect(res.content.map((m) => m.id), ['m2', 'm1']);
      expect(res.hasNext, isTrue);
      expect(res.totalElements, 57);
    });

    test('older page passes the `before` cursor; missing meta → defaults',
        () async {
      http.on('GET', '/api/conversations/c1/messages', {
        'content': [messageJson('m0')],
      });
      final res = await repo.getMessages('c1', before: 'm1', size: 10);
      expect(http.last.query, {'before': 'm1', 'size': 10});
      expect(res.hasNext, isFalse);
      expect(res.size, 10);
      expect(res.totalElements, 1);
    });

    test('catch-up sends UTC `after` + afterId', () async {
      http.on('GET', '/api/conversations/c1/messages', {
        'content': [messageJson('m3')],
        'hasNext': true,
      });
      final at = DateTime.utc(2024, 5, 1, 10, 30);
      final res = await repo.getMessagesSince('c1', at, afterId: 'm2');
      expect(http.last.query,
          {'after': '2024-05-01T10:30:00.000Z', 'afterId': 'm2'});
      expect(res.content.single.id, 'm3');
      expect(res.hasNext, isTrue);
    });

    test('catch-up without afterId omits it', () async {
      http.on('GET', '/api/conversations/c1/messages', {'content': []});
      final res = await repo.getMessagesSince('c1', DateTime.utc(2024));
      expect(http.last.query.containsKey('afterId'), isFalse);
      expect(res.content, isEmpty);
      expect(res.hasNext, isFalse);
    });

    test('search hits /api/messages/search scoped to the conversation',
        () async {
      http.on('GET', '/api/messages/search', [messageJson('m5')]);
      final res = await repo.searchMessages('c1', 'hello');
      expect(http.last.query, {'q': 'hello', 'conversationId': 'c1'});
      expect(res.single.id, 'm5');
    });

    test('link preview parses OG fields', () async {
      http.on('GET', '/api/utils/link-preview',
          {'url': 'https://a.io', 'title': 'A', 'siteName': 'A site'});
      final res = await repo.fetchLinkPreview('https://a.io');
      expect(http.last.query, {'url': 'https://a.io'});
      expect(res.title, 'A');
      expect(res.siteName, 'A site');
    });
  });

  group('send / read', () {
    test('REST send includes replyToId only when replying', () async {
      http.on('POST', '/api/messages', messageJson('srv-1', content: 'x'));
      final sent = await repo.sendMessageRest('c1', 'x');
      expect(http.last.body,
          {'conversationId': 'c1', 'content': 'x', 'type': 'text'});
      expect(sent.id, 'srv-1');

      await repo.sendMessageRest('c1', 'x', type: 'image', replyToId: 'm1');
      expect(http.last.body, {
        'conversationId': 'c1',
        'content': 'x',
        'type': 'image',
        'replyToId': 'm1',
      });
    });

    test('markAsRead → PUT /api/messages/{id}/read', () async {
      await repo.markAsRead('m1');
      expect(http.last.method, 'PUT');
      expect(http.last.path, '/api/messages/m1/read');
    });

    test('REST send error propagates as DioException with the status',
        () async {
      http.on('POST', '/api/messages', {'code': 'USER_BLOCKED'}, status: 403);
      await expectLater(
        repo.sendMessageRest('c1', 'x'),
        throwsA(isA<DioException>()
            .having((e) => e.response?.statusCode, 'status', 403)),
      );
    });
  });

  group('pin / forward / reactions / feedback', () {
    test('pin + unpin return the pinned id list (missing → empty)', () async {
      http.on('POST', '/api/messages/m1/pin', {'pinnedMessages': ['m1', 'm0']});
      expect(await repo.pinMessage('m1'), ['m1', 'm0']);
      http.on('DELETE', '/api/messages/m1/pin', <String, dynamic>{});
      expect(await repo.unpinMessage('m1'), isEmpty);
      expect(http.last.method, 'DELETE');
    });

    test('pin limit 409 surfaces to the caller', () async {
      http.on('POST', '/api/messages/m1/pin',
          {'code': 'PIN_LIMIT_REACHED', 'params': {'max': 5}},
          status: 409);
      await expectLater(repo.pinMessage('m1'), throwsA(isA<DioException>()));
    });

    test('forward posts the target conversation', () async {
      http.on('POST', '/api/messages/m1/forward',
          messageJson('f1', conversationId: 'c2'));
      final res = await repo.forwardMessage('m1', 'c2');
      expect(http.last.body, {'targetConversationId': 'c2'});
      expect(res.conversationId, 'c2');
    });

    test('add / remove reaction', () async {
      await repo.addReaction('m1', '👍');
      expect(http.last.method, 'POST');
      expect(http.last.path, '/api/messages/m1/reactions');
      expect(http.last.body, {'emoji': '👍'});
      await repo.removeReaction('m1');
      expect(http.last.method, 'DELETE');
      expect(http.last.path, '/api/messages/m1/reactions');
    });

    test('feedback: comment only when non-empty; server value wins', () async {
      http.on('POST', '/api/messages/m1/feedback',
          {'rating': 'down', 'comment': 'wrong'});
      final r = await repo.submitFeedback('m1', 'down', comment: 'wrong');
      expect(http.last.body, {'rating': 'down', 'comment': 'wrong'});
      expect(r.rating, 'down');
      expect(r.comment, 'wrong');

      http.on('POST', '/api/messages/m1/feedback', <String, dynamic>{});
      final r2 = await repo.submitFeedback('m1', 'up', comment: '');
      expect(http.last.body, {'rating': 'up'});
      expect(r2.rating, 'up');
      expect(r2.comment, isNull);
    });
  });

  group('edit / recall / delete', () {
    test('edit → PUT with content, parses the updated message', () async {
      http.on('PUT', '/api/messages/m1', messageJson('m1', content: 'new'));
      final m = await repo.editMessage('m1', 'new');
      expect(http.last.body, {'content': 'new'});
      expect(m.content, 'new');
    });

    test('recall → DELETE /api/messages/{id}; 403 (not sender) propagates',
        () async {
      await repo.recallMessage('m1');
      expect(http.last.method, 'DELETE');
      expect(http.last.path, '/api/messages/m1');

      http.on('DELETE', '/api/messages/m2', {'code': 'FORBIDDEN'}, status: 403);
      await expectLater(
        repo.recallMessage('m2'),
        throwsA(isA<DioException>()
            .having((e) => e.response?.statusCode, 'status', 403)),
      );
    });

    test('delete-for-me → POST …/delete-for-me', () async {
      await repo.deleteMessageForMe('m1');
      expect(http.last.method, 'POST');
      expect(http.last.path, '/api/messages/m1/delete-for-me');
    });
  });
}
