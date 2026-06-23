// Tests for ChatAiStreamHandler — the AI streaming state machine that maps
// Redis AI_STREAM_* events onto the streaming placeholder. Critically this
// covers the error-code → sentinel mapping (AI_QUOTA_EXCEEDED /
// AI_STREAM_INTERRUPTED / AI_UNAVAILABLE), which must stay in sync with web
// (recent sync-parity commits). The handler takes injectable state callbacks,
// so it tests cleanly with no STOMP / Dio / Riverpod.
//
// Note: fake_async is not a dependency, so the watchdog Timer is not unit-tested
// here; chunk accumulation, DONE, and all error mappings are covered directly.

import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_ai_stream_handler.dart';
// chat_state re-exports chat_models (MessageModel, kAi* sentinels, etc.).
import 'package:platform_client/features/chat/domain/chat_state.dart';

/// A tiny mutable holder that plays the role ChatNotifier plays for the
/// handler: it owns the message list and exposes read/write callbacks.
class _StateHost {
  ChatState? state;
  _StateHost(List<MessageModel> messages)
      : state = ChatState(messages: messages, hasMore: false);

  ChatState? read() => state;

  void writeMessages(List<MessageModel> messages) {
    state = state!.copyWith(messages: messages);
  }
}

MessageModel _aiPlaceholder({
  String id = 'ai-pending-1',
  String content = '',
  bool isStreaming = true,
  bool isThinking = true,
}) =>
    MessageModel(
      id: id,
      conversationId: 'c-1',
      senderId: kAiBotUserId,
      content: content,
      type: 'ai',
      readBy: const [],
      isStreaming: isStreaming,
      isThinking: isThinking,
      createdAt: DateTime(2024, 1, 1),
    );

/// Builds a handler wired to [host] with [placeholderId] already marked pending
/// (so onStreamEvent correlates by id). beginPending also arms the watchdog
/// timer; each test calls dispose() to cancel it and avoid a pending-timer leak.
ChatAiStreamHandler _handlerFor(_StateHost host, {String? placeholderId}) {
  final h = ChatAiStreamHandler(
    readState: host.read,
    writeMessages: host.writeMessages,
  );
  if (placeholderId != null) h.beginPending(placeholderId);
  return h;
}

void main() {
  group('AI_STREAM_CHUNK', () {
    test('accumulates chunk content and clears the thinking flag', () {
      final host = _StateHost([_aiPlaceholder(content: '')]);
      final h = _handlerFor(host, placeholderId: 'ai-pending-1');

      h.onStreamEvent({'type': 'AI_STREAM_CHUNK', 'chunk': 'Hel'});
      h.onStreamEvent({'type': 'AI_STREAM_CHUNK', 'chunk': 'lo'});

      final msg = host.read()!.messages.single;
      expect(msg.content, 'Hello');
      expect(msg.isThinking, isFalse);
      expect(msg.isStreaming, isTrue); // still streaming until DONE/ERROR
      h.dispose();
    });
  });

  group('AI_TOOL_CALL', () {
    test('appends the active tool name to the placeholder', () {
      final host = _StateHost([_aiPlaceholder()]);
      final h = _handlerFor(host, placeholderId: 'ai-pending-1');

      h.onStreamEvent({'type': 'AI_TOOL_CALL', 'toolName': 'web_search'});

      expect(host.read()!.messages.single.activeTools, ['web_search']);
      h.dispose();
    });
  });

  group('AI_STREAM_DONE', () {
    test('clears streaming/thinking flags and stores sources + trace', () {
      final host = _StateHost([_aiPlaceholder(content: 'answer')]);
      final h = _handlerFor(host, placeholderId: 'ai-pending-1');

      h.onStreamEvent({
        'type': 'AI_STREAM_DONE',
        'sources': [
          {'documentId': 'doc-1'},
          {'documentId': ''}, // empty id is dropped
          {'documentId': 'doc-2'},
        ],
        'trace': {
          'model': 'claude',
          'inputTokens': 10,
          'outputTokens': 5,
        },
      });

      final msg = host.read()!.messages.single;
      expect(msg.isStreaming, isFalse);
      expect(msg.isThinking, isFalse);
      // sources is List<AiSource> (TASK-06 clickable citations); the empty-id
      // entry is dropped and order is preserved.
      expect(msg.sources?.map((s) => s.documentId).toList(), ['doc-1', 'doc-2']);
      expect(msg.trace, isNotNull);
      expect(msg.trace!.model, 'claude');
      // DONE remembers the finalized placeholder id for later swap.
      expect(h.finalizedAiPlaceholderId, 'ai-pending-1');
      h.dispose();
    });
  });

  group('AI_STREAM_ERROR — code → sentinel mapping (web sync parity)', () {
    void expectErrorMaps(Map<String, dynamic> payload, String sentinel) {
      final host = _StateHost([_aiPlaceholder(content: 'partial')]);
      final h = _handlerFor(host, placeholderId: 'ai-pending-1');
      h.onStreamEvent({'type': 'AI_STREAM_ERROR', ...payload});
      final msg = host.read()!.messages.single;
      expect(msg.content, sentinel);
      expect(msg.isStreaming, isFalse);
      expect(msg.isThinking, isFalse);
      h.dispose();
    }

    test('AI_QUOTA_EXCEEDED code → quota sentinel', () {
      expectErrorMaps(
        {'code': kAiErrCodeQuotaExceeded},
        kAiQuotaExceededSentinel,
      );
    });

    test('AI_STREAM_INTERRUPTED code → interrupted sentinel', () {
      expectErrorMaps(
        {'code': kAiErrCodeStreamInterrupted},
        kAiStreamInterruptedSentinel,
      );
    });

    test('AI_UNAVAILABLE code → unavailable sentinel', () {
      expectErrorMaps(
        {'code': kAiErrCodeUnavailable},
        kAiUnavailableSentinel,
      );
    });

    test('unknown / missing code → generic error sentinel', () {
      expectErrorMaps(
        {'error': 'something exploded'},
        kAiErrorSentinel,
      );
    });

    test('legacy pre-code payload mentioning "quota" → quota sentinel', () {
      // Backward-compat: no code field, heuristic on the message text.
      expectErrorMaps(
        {'error': 'Monthly quota limit reached'},
        kAiQuotaExceededSentinel,
      );
    });

    test('mapped sentinel makes the right MessageModel getter true', () {
      final host = _StateHost([_aiPlaceholder()]);
      final h = _handlerFor(host, placeholderId: 'ai-pending-1');
      h.onStreamEvent(
          {'type': 'AI_STREAM_ERROR', 'code': kAiErrCodeUnavailable});
      expect(host.read()!.messages.single.isAiUnavailable, isTrue);
      h.dispose();
    });
  });

  group('robustness', () {
    test('ignores events with no matching placeholder', () {
      // No pending id and no streaming AI message → no-op, no throw.
      final host = _StateHost([
        MessageModel(
          id: 'plain',
          conversationId: 'c-1',
          senderId: 'user-1',
          content: 'hi',
          type: 'text',
          readBy: const [],
          createdAt: DateTime(2024, 1, 1),
        )
      ]);
      final h = _handlerFor(host);
      h.onStreamEvent({'type': 'AI_STREAM_CHUNK', 'chunk': 'x'});
      expect(host.read()!.messages.single.content, 'hi');
      h.dispose();
    });

    test('ignores events with a null/unknown type', () {
      final host = _StateHost([_aiPlaceholder(content: 'keep')]);
      final h = _handlerFor(host, placeholderId: 'ai-pending-1');
      h.onStreamEvent({'chunk': 'x'}); // no type
      expect(host.read()!.messages.single.content, 'keep');
      h.dispose();
    });
  });
}
