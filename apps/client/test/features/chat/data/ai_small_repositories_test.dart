// KB / AI persona / AI memory / AI action repositories: exact routes, bodies
// and parsing, including 404-as-null and error propagation.

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/ai_actions_repository.dart';
import 'package:platform_client/features/chat/data/ai_memory_repository.dart';
import 'package:platform_client/features/chat/data/ai_persona_repository.dart';
import 'package:platform_client/features/chat/data/kb_repository.dart';
import 'package:platform_client/features/chat/domain/ai_action_card_logic.dart';

import 'recording_adapter.dart';

void main() {
  late RecordingAdapter http;
  late Dio dio;

  setUp(() {
    http = RecordingAdapter();
    dio = recordingDio(http);
  });

  group('KbRepository', () {
    test('uploadDocument posts the file reference and parses the doc', () async {
      http.on('POST', '/api/kb/documents', {
        'documentId': 'd1',
        'fileName': 'spec.pdf',
        'mimeType': 'application/pdf',
        'status': 'processing',
        'chunkCount': 3,
        'uploadedAt': '2026-01-02T03:04:05Z',
      });
      final doc = await KbRepository(dio).uploadDocument(
        conversationId: 'c1',
        fileUrl: 'https://f/x.pdf',
        fileName: 'spec.pdf',
        mimeType: 'application/pdf',
      );
      expect(http.last.method, 'POST');
      expect(http.last.body, {
        'conversationId': 'c1',
        'fileUrl': 'https://f/x.pdf',
        'fileName': 'spec.pdf',
        'mimeType': 'application/pdf',
      });
      expect(doc.documentId, 'd1');
      expect(doc.chunkCount, 3);
      expect(doc.isProcessing, isTrue);
      expect(doc.uploadedAt, DateTime.utc(2026, 1, 2, 3, 4, 5));
    });

    test('getDocuments sends conversationId and maps a list (null → [])',
        () async {
      http.on('GET', '/api/kb/documents', [
        {'documentId': 'a', 'status': 'done'},
        {'documentId': 'b', 'status': 'error'},
      ]);
      final docs = await KbRepository(dio).getDocuments('c9');
      expect(http.last.query, {'conversationId': 'c9'});
      expect(docs.map((d) => d.documentId), ['a', 'b']);
      expect(docs[0].isReady, isTrue);
      expect(docs[1].isError, isTrue);
      // Defaults for missing fields.
      expect(docs[0].fileName, '');
      expect(docs[0].mimeType, '');
      expect(docs[0].uploadedAt, isNull);

      http.on('GET', '/api/kb/documents', null);
      expect(await KbRepository(dio).getDocuments('c9'), isEmpty);
    });

    test('deleteDocument hits the document route; errors propagate', () async {
      await KbRepository(dio).deleteDocument('d7');
      expect(http.last.method, 'DELETE');
      expect(http.last.path, '/api/kb/documents/d7');

      http.on('DELETE', '/api/kb/documents/d8', {'code': 'FORBIDDEN'},
          status: 403);
      await expectLater(KbRepository(dio).deleteDocument('d8'),
          throwsA(isA<DioException>()));
    });
  });

  group('AiPersonaRepository', () {
    const path = '/api/conversations/c1/ai-persona';

    test('getPersona parses, blank name → null (workspace name applies)',
        () async {
      http.on('GET', path, {
        'conversationId': 'c1',
        'name': '  ',
        'tone': 'formal',
        'avatarUrl': 'https://a/p.png',
      });
      final p = await AiPersonaRepository(dio).getPersona('c1');
      expect(p?.name, isNull);
      expect(p?.tone, 'formal');
      expect(p?.avatarUrl, 'https://a/p.png');
    });

    test('getPersona: 404 → null, other errors rethrow', () async {
      http.on('GET', path, {'code': 'NOT_FOUND'}, status: 404);
      expect(await AiPersonaRepository(dio).getPersona('c1'), isNull);

      http.on('GET', path, {'code': 'FORBIDDEN'}, status: 403);
      await expectLater(AiPersonaRepository(dio).getPersona('c1'),
          throwsA(isA<DioException>()
              .having((e) => e.response?.statusCode, 'status', 403)));
    });

    test('upsertPersona PUTs the body; deletePersona DELETEs', () async {
      http.on('PUT', path,
          {'conversationId': 'c1', 'name': 'Pon', 'systemPromptPrefix': 'Be brief'});
      final saved = await AiPersonaRepository(dio)
          .upsertPersona('c1', {'name': 'Pon', 'tone': 'friendly'});
      expect(http.last.method, 'PUT');
      expect(http.last.body, {'name': 'Pon', 'tone': 'friendly'});
      expect(saved.name, 'Pon');
      expect(saved.tone, 'friendly'); // default when absent
      expect(saved.systemPromptPrefix, 'Be brief');

      await AiPersonaRepository(dio).deletePersona('c1');
      expect(http.last.method, 'DELETE');
      expect(http.last.path, path);
    });
  });

  group('AiMemoryRepository', () {
    test('getMyMemories parses the aggregate; non-map → null', () async {
      http.on('GET', '/api/ai/memories', {
        'summary': 'Likes tea',
        'keyFacts': ['tea', 'cats'],
        'messageCount': 12,
        'updatedAt': '2026-03-04T00:00:00Z',
      });
      final m = await AiMemoryRepository(dio).getMyMemories();
      expect(m?.conversationId, isNull);
      expect(m?.summary, 'Likes tea');
      expect(m?.keyFacts, ['tea', 'cats']);
      expect(m?.messageCount, 12);
      expect(m?.updatedAt, DateTime.utc(2026, 3, 4));

      http.on('GET', '/api/ai/memories', ['not', 'a', 'map']);
      expect(await AiMemoryRepository(dio).getMyMemories(), isNull);
    });

    test('conversation memory + delete use the conversation route', () async {
      http.on('GET', '/api/ai/memories/c5', {'conversationId': 'c5'});
      final m = await AiMemoryRepository(dio).getConversationMemory('c5');
      expect(m?.conversationId, 'c5');
      expect(m?.summary, '');
      expect(m?.keyFacts, isEmpty);
      expect(m?.messageCount, 0);

      await AiMemoryRepository(dio).deleteMemory('c5');
      expect(http.last.method, 'DELETE');
      expect(http.last.path, '/api/ai/memories/c5');
    });
  });

  group('AiActionsRepository', () {
    test('confirm / cancel post to the encoded action route and map status',
        () async {
      http.on('POST', '/ai/actions/a%2F1/confirm', {'status': 'confirmed'});
      http.on('POST', '/ai/actions/a%2F1/cancel', {'status': 'cancelled'});
      final repo = AiActionsRepository(dio);
      expect(await repo.confirm('a/1'), ActionCardKind.confirmed);
      expect(http.last.body, isNull);
      expect(await repo.cancel('a/1'), ActionCardKind.cancelled);
    });

    test('unexpected body → null; HTTP errors propagate', () async {
      http.on('POST', '/ai/actions/x/confirm', {'status': 'weird'});
      expect(await AiActionsRepository(dio).confirm('x'), isNull);
      http.on('POST', '/ai/actions/y/confirm', {'code': 'ACTION_EXPIRED'},
          status: 410);
      await expectLater(
          AiActionsRepository(dio).confirm('y'), throwsA(isA<DioException>()));
    });
  });
}
