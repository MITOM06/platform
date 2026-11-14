// Riverpod notifiers of the per-conversation AI features: knowledge base
// (incl. live STOMP status updates), persona, memory and the confirm/cancel
// flow of sensitive AI actions.

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:platform_client/features/chat/data/ai_actions_repository.dart';
import 'package:platform_client/features/chat/data/ai_memory_repository.dart';
import 'package:platform_client/features/chat/data/ai_persona_repository.dart';
import 'package:platform_client/features/chat/data/kb_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/ai_action_card_logic.dart';
import 'package:platform_client/features/chat/domain/ai_actions_provider.dart';
import 'package:platform_client/features/chat/domain/ai_memory_model.dart';
import 'package:platform_client/features/chat/domain/ai_memory_provider.dart';
import 'package:platform_client/features/chat/domain/ai_persona_model.dart';
import 'package:platform_client/features/chat/domain/ai_persona_provider.dart';
import 'package:platform_client/features/chat/domain/kb_document_model.dart';
import 'package:platform_client/features/chat/domain/kb_provider.dart';

class _Kb extends Mock implements KbRepository {}

class _Persona extends Mock implements AiPersonaRepository {}

class _Memory extends Mock implements AiMemoryRepository {}

class _Actions extends Mock implements AiActionsRepository {}

class _Stomp extends StompService {
  final kb = StreamController<Map<String, dynamic>>.broadcast();
  @override
  void build() {}
  @override
  Stream<Map<String, dynamic>> get kbStatusEvents => kb.stream;
}

KbDocumentModel _doc(String id, {String status = 'processing', int chunks = 0}) =>
    KbDocumentModel(
        documentId: id,
        fileName: '$id.pdf',
        mimeType: 'application/pdf',
        status: status,
        chunkCount: chunks);

DioException _http(int status, [Object? body]) {
  final o = RequestOptions(path: '/x');
  return DioException(
      requestOptions: o,
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: o, statusCode: status, data: body));
}

Future<void> _tick() => Future<void>.delayed(Duration.zero);

void main() {
  group('KbNotifier', () {
    late _Kb repo;
    late _Stomp stomp;
    late ProviderContainer c;

    setUp(() {
      repo = _Kb();
      stomp = _Stomp();
      c = ProviderContainer(overrides: [
        kbRepositoryProvider.overrideWithValue(repo),
        stompServiceProvider.overrideWith(() => stomp),
      ]);
    });
    tearDown(() => c.dispose());

    test('loads documents, then applies STOMP status updates to the right doc',
        () async {
      when(() => repo.getDocuments('c1'))
          .thenAnswer((_) async => [_doc('a'), _doc('b', chunks: 2)]);
      final docs = await c.read(kbDocumentsProvider('c1').future);
      expect(docs.map((d) => d.documentId), ['a', 'b']);

      stomp.kb.add({'documentId': 'b', 'status': 'done', 'chunkCount': 9});
      await _tick();
      var now = c.read(kbDocumentsProvider('c1')).value!;
      expect(now[1].status, 'done');
      expect(now[1].chunkCount, 9);
      expect(now[0].status, 'processing');

      // No chunkCount → keep the old one.
      stomp.kb.add({'documentId': 'a', 'status': 'error'});
      await _tick();
      now = c.read(kbDocumentsProvider('c1')).value!;
      expect(now[0].status, 'error');
      expect(now[0].chunkCount, 0);
    });

    test('ignores malformed and unknown-document status events', () async {
      when(() => repo.getDocuments('c1')).thenAnswer((_) async => [_doc('a')]);
      await c.read(kbDocumentsProvider('c1').future);
      final before = c.read(kbDocumentsProvider('c1')).value;
      stomp.kb
        ..add({'status': 'done'})
        ..add({'documentId': 'a'})
        ..add({'documentId': 'zzz', 'status': 'done'});
      await _tick();
      expect(identical(c.read(kbDocumentsProvider('c1')).value, before), isTrue);
    });

    test('upload prepends the new doc; delete removes it', () async {
      when(() => repo.getDocuments('c1')).thenAnswer((_) async => [_doc('a')]);
      when(() => repo.uploadDocument(
            conversationId: 'c1',
            fileUrl: 'u',
            fileName: 'n.pdf',
            mimeType: 'application/pdf',
          )).thenAnswer((_) async => _doc('new'));
      when(() => repo.deleteDocument('a')).thenAnswer((_) async {});
      await c.read(kbDocumentsProvider('c1').future);
      final n = c.read(kbDocumentsProvider('c1').notifier);

      await n.upload('c1', 'u', 'n.pdf', 'application/pdf');
      expect(c.read(kbDocumentsProvider('c1')).value!.map((d) => d.documentId),
          ['new', 'a']);

      await n.delete('a');
      expect(c.read(kbDocumentsProvider('c1')).value!.map((d) => d.documentId),
          ['new']);
      verify(() => repo.deleteDocument('a')).called(1);
    });

    test('a failed load surfaces as AsyncError; a failed upload keeps state',
        () async {
      when(() => repo.getDocuments('c1')).thenThrow(_http(403));
      await expectLater(c.read(kbDocumentsProvider('c1').future),
          throwsA(isA<DioException>()));
      expect(c.read(kbDocumentsProvider('c1')).hasError, isTrue);
    });
  });

  group('AiPersonaNotifier', () {
    late _Persona repo;
    late ProviderContainer c;
    setUp(() {
      repo = _Persona();
      c = ProviderContainer(
          overrides: [aiPersonaRepositoryProvider.overrideWithValue(repo)]);
    });
    tearDown(() => c.dispose());

    test('build loads, save upserts the body, reset clears to null', () async {
      when(() => repo.getPersona('c1')).thenAnswer((_) async => null);
      expect(await c.read(aiPersonaProvider('c1').future), isNull);

      when(() => repo.upsertPersona('c1', {'tone': 'formal'})).thenAnswer(
          (_) async =>
              const AiPersonaModel(conversationId: 'c1', tone: 'formal'));
      await c.read(aiPersonaProvider('c1').notifier).save({'tone': 'formal'});
      expect(c.read(aiPersonaProvider('c1')).value?.tone, 'formal');

      when(() => repo.deletePersona('c1')).thenAnswer((_) async {});
      await c.read(aiPersonaProvider('c1').notifier).reset();
      expect(c.read(aiPersonaProvider('c1')).value, isNull);
      verify(() => repo.deletePersona('c1')).called(1);
    });

    test('save failure propagates and keeps the previous persona', () async {
      const p = AiPersonaModel(conversationId: 'c1', tone: 'friendly');
      when(() => repo.getPersona('c1')).thenAnswer((_) async => p);
      await c.read(aiPersonaProvider('c1').future);
      when(() => repo.upsertPersona(any(), any())).thenThrow(_http(500));
      await expectLater(
          c.read(aiPersonaProvider('c1').notifier).save({'tone': 'x'}),
          throwsA(isA<DioException>()));
      expect(c.read(aiPersonaProvider('c1')).value, same(p));
    });

    test('AiPersonaModel.toRequestJson drops empty optional fields', () {
      expect(
          const AiPersonaModel(
                  conversationId: 'c', name: '', tone: 'calm',
                  systemPromptPrefix: '')
              .toRequestJson(),
          {'tone': 'calm'});
      expect(
          const AiPersonaModel(
                  conversationId: 'c',
                  name: 'Pon',
                  avatarUrl: 'a',
                  tone: 'calm',
                  systemPromptPrefix: 'Hi')
              .toRequestJson(),
          {'name': 'Pon', 'avatarUrl': 'a', 'tone': 'calm', 'systemPromptPrefix': 'Hi'});
    });
  });

  group('AiMemoriesNotifier', () {
    test('deleteMemory deletes then reloads the aggregate', () async {
      final repo = _Memory();
      final c = ProviderContainer(
          overrides: [aiMemoryRepositoryProvider.overrideWithValue(repo)]);
      addTearDown(c.dispose);
      var calls = 0;
      when(() => repo.getMyMemories()).thenAnswer((_) async {
        calls++;
        return calls == 1
            ? AiMemoryModel(
                conversationId: null,
                summary: 'x',
                keyFacts: const ['a'],
                messageCount: 1,
                updatedAt: DateTime(2026))
            : null;
      });
      when(() => repo.deleteMemory('c1')).thenAnswer((_) async {});
      final sub = c.listen(aiMemoriesProvider, (_, __) {});
      addTearDown(sub.close);
      expect((await c.read(aiMemoriesProvider.future))?.summary, 'x');
      await c.read(aiMemoriesProvider.notifier).deleteMemory('c1');
      expect(c.read(aiMemoriesProvider).value, isNull);
      expect(calls, 2);
      verify(() => repo.deleteMemory('c1')).called(1);
    });
  });

  group('AiActionsNotifier', () {
    late _Actions repo;
    late ProviderContainer c;
    setUp(() {
      repo = _Actions();
      c = ProviderContainer(
          overrides: [aiActionsRepositoryProvider.overrideWithValue(repo)]);
    });
    tearDown(() => c.dispose());

    test('confirm records the server outcome and clears in-flight', () async {
      when(() => repo.confirm('a1'))
          .thenAnswer((_) async => ActionCardKind.failed);
      final err = await c.read(aiActionsProvider.notifier).confirm('a1');
      expect(err, isNull);
      expect(c.read(aiActionsProvider).local, {'a1': ActionCardKind.failed});
      expect(c.read(aiActionsProvider).inFlight, isEmpty);
    });

    test('null outcome falls back to confirmed / cancelled', () async {
      when(() => repo.confirm('a1')).thenAnswer((_) async => null);
      when(() => repo.cancel('a2')).thenAnswer((_) async => null);
      final n = c.read(aiActionsProvider.notifier);
      await n.confirm('a1');
      await n.cancel('a2');
      expect(c.read(aiActionsProvider).local,
          {'a1': ActionCardKind.confirmed, 'a2': ActionCardKind.cancelled});
    });

    test('a double tap while in flight sends one request', () async {
      final gate = Completer<ActionCardKind?>();
      when(() => repo.cancel('a1')).thenAnswer((_) => gate.future);
      final n = c.read(aiActionsProvider.notifier);
      final first = n.cancel('a1');
      expect(c.read(aiActionsProvider).inFlight, {'a1'});
      expect(await n.cancel('a1'), isNull);
      gate.complete(ActionCardKind.cancelled);
      await first;
      verify(() => repo.cancel('a1')).called(1);
      expect(c.read(aiActionsProvider).inFlight, isEmpty);
    });

    test('errors map to typed failures and the next card state', () async {
      final n = c.read(aiActionsProvider.notifier);
      when(() => repo.confirm('exp')).thenThrow(_http(410));
      expect(await n.confirm('exp'), AiActionError.expired);
      expect(c.read(aiActionsProvider).local['exp'], ActionCardKind.expired);

      when(() => repo.confirm('own')).thenThrow(_http(403, {'code': 'ACTION_NOT_OWNER'}));
      expect(await n.confirm('own'), AiActionError.notOwner);
      expect(c.read(aiActionsProvider).local.containsKey('own'), isFalse);

      when(() => repo.confirm('net')).thenThrow(DioException(
          requestOptions: RequestOptions(path: '/x'),
          type: DioExceptionType.connectionError));
      expect(await n.confirm('net'), AiActionError.network);
      expect(c.read(aiActionsProvider).inFlight, isEmpty);
    });
  });
}
