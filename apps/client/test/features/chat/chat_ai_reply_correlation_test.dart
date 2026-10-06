// @AI replies are correlated by `replyId`. chat-service sends the persisted
// AI message BEFORE `AI_STREAM_DONE`; older servers sent DONE first. Both
// orders must end with exactly one bubble per reply (the old heuristic
// duplicated the answer and put the next one in the previous one's place).

import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_ai_stream_handler.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/domain/chat_stomp_reducers.dart';

class _Host {
  ChatState? state = const ChatState(messages: [], hasMore: false);
  ChatState? read() => state;
  void write(List<MessageModel> messages) =>
      state = state!.copyWith(messages: messages);

  /// What ChatNotifier._onNewMessage does with a persisted message.
  void deliver(ChatAiStreamHandler h, MessageModel m) {
    final msgs = state!.messages;
    write(h.reconcilePersisted(msgs, m) ??
        ChatStompReducers.reconcileNewMessage(msgs, m));
  }

  List<MessageModel> get ai =>
      state!.messages.where((m) => m.isAiMessage).toList();
}

MessageModel _placeholder(String id) => MessageModel(
      id: id,
      conversationId: 'c1',
      senderId: kAiBotUserId,
      content: '',
      type: 'ai',
      readBy: const [],
      createdAt: DateTime(2024),
      isStreaming: true,
      isThinking: true,
    );

MessageModel _persisted(String id, String content) => MessageModel(
      id: id,
      conversationId: 'c1',
      senderId: kAiBotUserId,
      content: content,
      type: 'ai',
      readBy: const [],
      createdAt: DateTime(2024),
    );

Map<String, dynamic> _chunk(String replyId, String chunk,
        {String requester = 'me'}) =>
    {
      'type': 'AI_STREAM_CHUNK',
      'chunk': chunk,
      'replyId': replyId,
      'requesterId': requester,
    };

Map<String, dynamic> _done(String replyId, {String requester = 'me'}) => {
      'type': 'AI_STREAM_DONE',
      'replyId': replyId,
      'requesterId': requester,
      'sources': [
        {'documentId': 'doc-1', 'fileName': 'a.pdf'}
      ],
    };

ChatAiStreamHandler _handler(_Host host) => ChatAiStreamHandler(
      readState: host.read,
      writeMessages: host.write,
      currentUserId: () => 'me',
      conversationId: 'c1',
    );

void main() {
  test('persisted message BEFORE DONE → one bubble, sources attached', () {
    final host = _Host()..write([_placeholder('ai-pending-1')]);
    final h = _handler(host)..beginPending('ai-pending-1');

    h.onStreamEvent(_chunk('r1', 'Hello '));
    h.onStreamEvent(_chunk('r1', 'world'));
    host.deliver(h, _persisted('srv-1', 'Hello world'));
    h.onStreamEvent(_done('r1'));

    expect(host.ai.map((m) => m.id), ['srv-1']);
    expect(host.ai.single.isStreaming, isFalse);
    expect(host.ai.single.sources?.single.documentId, 'doc-1');
    expect(h.slots, isEmpty);
    h.dispose();
  });

  test('DONE BEFORE persisted message (older servers) → still one bubble', () {
    final host = _Host()..write([_placeholder('ai-pending-1')]);
    final h = _handler(host)..beginPending('ai-pending-1');

    h.onStreamEvent(_chunk('r1', 'Hi'));
    h.onStreamEvent(_done('r1'));
    host.deliver(h, _persisted('srv-1', 'Hi'));

    expect(host.ai.map((m) => m.id), ['srv-1']);
    expect(host.ai.single.sources?.single.documentId, 'doc-1');
    expect(h.slots, isEmpty);
    h.dispose();
  });

  test('the next answer goes to its own bubble, not the previous one', () {
    final host = _Host()..write([_placeholder('ai-pending-1')]);
    final h = _handler(host)..beginPending('ai-pending-1');
    h.onStreamEvent(_chunk('r1', 'First'));
    host.deliver(h, _persisted('srv-1', 'First'));
    h.onStreamEvent(_done('r1'));

    host.write([_placeholder('ai-pending-2'), ...host.state!.messages]);
    h.beginPending('ai-pending-2');
    h.onStreamEvent(_chunk('r2', 'Second'));
    host.deliver(h, _persisted('srv-2', 'Second'));
    h.onStreamEvent(_done('r2'));

    expect(host.ai.map((m) => '${m.id}:${m.content}'),
        ['srv-2:Second', 'srv-1:First']);
    h.dispose();
  });

  test('two overlapping replies are routed by replyId', () {
    final host = _Host()
      ..write([_placeholder('ai-pending-2'), _placeholder('ai-pending-1')]);
    final h = _handler(host)
      ..beginPending('ai-pending-1')
      ..beginPending('ai-pending-2');

    h.onStreamEvent(_chunk('rA', 'Alpha'));
    h.onStreamEvent(_chunk('rB', 'Beta'));
    h.onStreamEvent(_chunk('rA', ' one'));
    host.deliver(h, _persisted('srv-B', 'Beta'));
    h.onStreamEvent(_done('rB'));
    host.deliver(h, _persisted('srv-A', 'Alpha one'));
    h.onStreamEvent(_done('rA'));

    final byId = {for (final m in host.ai) m.id: m.content};
    expect(byId, {'srv-A': 'Alpha one', 'srv-B': 'Beta'});
    h.dispose();
  });

  test('another member\'s @AI streams into a live bubble of its own', () {
    final host = _Host();
    final h = _handler(host);
    h.onStreamEvent(_chunk('rX', 'For Bob', requester: 'bob'));
    expect(host.ai.single.isStreaming, isTrue);
    host.deliver(h, _persisted('srv-X', 'For Bob'));
    h.onStreamEvent(_done('rX', requester: 'bob'));
    expect(host.ai.map((m) => m.id), ['srv-X']);
    h.dispose();
  });

  test('my pending placeholder is not stolen by someone else\'s reply', () {
    final host = _Host()..write([_placeholder('ai-pending-1')]);
    final h = _handler(host)..beginPending('ai-pending-1');
    h.onStreamEvent(_chunk('rBob', 'Bob answer', requester: 'bob'));
    h.onStreamEvent(_chunk('rMe', 'My answer'));
    final mine = host.state!.messages.firstWhere((m) => m.id == 'ai-pending-1');
    expect(mine.content, 'My answer');
    h.dispose();
  });

  test('a late event for a finished reply never binds to a new request', () {
    final host = _Host()..write([_placeholder('ai-pending-1')]);
    final h = _handler(host)..beginPending('ai-pending-1');
    h.onStreamEvent(_chunk('r1', 'Done'));
    host.deliver(h, _persisted('srv-1', 'Done'));
    h.onStreamEvent(_done('r1'));

    host.write([_placeholder('ai-pending-2'), ...host.state!.messages]);
    h.beginPending('ai-pending-2');
    h.onStreamEvent(_chunk('r1', 'stray'));
    final pending =
        host.state!.messages.firstWhere((m) => m.id == 'ai-pending-2');
    expect(pending.content, isEmpty);
    expect(h.slots.single.replyId, isNull);
    h.dispose();
  });

  test('a cached answer with no chunks still replaces my placeholder', () {
    final host = _Host()..write([_placeholder('ai-pending-1')]);
    final h = _handler(host)..beginPending('ai-pending-1');
    host.deliver(h, _persisted('srv-1', 'From cache'));
    h.onStreamEvent(_done('r1'));
    expect(host.ai.map((m) => m.id), ['srv-1']);
    expect(h.slots, isEmpty);
    h.dispose();
  });

  test(
      'DONE with nothing streamed and nothing persisted → empty-response '
      'notice, not a blank bubble', () {
    final host = _Host()..write([_placeholder('ai-pending-1')]);
    final h = _handler(host)..beginPending('ai-pending-1');
    h.onStreamEvent(
        {'type': 'AI_STREAM_DONE', 'replyId': 'r1', 'requesterId': 'me'});
    expect(host.ai.single.isAiEmptyResponse, isTrue);
    h.dispose();
  });

  test('AI_EMPTY_RESPONSE error code maps to its own sentinel', () {
    expect(
        aiErrorSentinelFor('AI_EMPTY_RESPONSE', ''), kAiEmptyResponseSentinel);
    expect(aiErrorSentinelFor('AI_RATE_LIMITED', ''), kAiRateLimitedSentinel);
    expect(aiErrorSentinelFor('SOMETHING', ''), kAiErrorSentinel);
  });

  test('cancelPending forgets a request whose send failed', () {
    final host = _Host()..write([_placeholder('ai-pending-1')]);
    final h = _handler(host)..beginPending('ai-pending-1');
    h.cancelPending('ai-pending-1');
    expect(h.slots, isEmpty);
    h.dispose();
  });
}
