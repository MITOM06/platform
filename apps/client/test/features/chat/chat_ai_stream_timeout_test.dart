// ChatAiStreamHandler: the 30 s watchdog (driven with fake time via
// testWidgets), legacy adoption of an untracked streaming bubble, remote
// bubbles for another member's request, sensitive tools and pending actions.

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/chat_ai_stream_handler.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';

class _Host {
  _Host(List<MessageModel> messages)
      : state = ChatState(messages: messages, hasMore: false);
  ChatState? state;
  ChatState? read() => state;
  void write(List<MessageModel> m) => state = state!.copyWith(messages: m);
  List<MessageModel> get msgs => state!.messages;
}

MessageModel _bubble(String id, {bool streaming = true}) => MessageModel(
      id: id,
      conversationId: 'c1',
      senderId: kAiBotUserId,
      content: '',
      type: 'ai',
      readBy: const [],
      isStreaming: streaming,
      isThinking: streaming,
      createdAt: DateTime(2024),
    );

void main() {
  testWidgets('my silent request turns into the error sentinel after 30 s',
      (tester) async {
    final host = _Host([_bubble('p1')]);
    final h = ChatAiStreamHandler(readState: host.read, writeMessages: host.write);
    h.beginPending('p1');
    await tester.pump(const Duration(seconds: 29));
    expect(host.msgs.single.isStreaming, isTrue);
    await tester.pump(const Duration(seconds: 2));
    final m = host.msgs.single;
    expect(m.content, kAiErrorSentinel);
    expect(m.isStreaming, isFalse);
    expect(m.isThinking, isFalse);
    expect(h.slots, isEmpty);
  });

  testWidgets('a chunk re-arms the watchdog', (tester) async {
    final host = _Host([_bubble('p1')]);
    final h = ChatAiStreamHandler(readState: host.read, writeMessages: host.write);
    h.beginPending('p1');
    await tester.pump(const Duration(seconds: 20));
    h.onStreamEvent({'type': 'AI_STREAM_CHUNK', 'chunk': 'Hi'});
    await tester.pump(const Duration(seconds: 20));
    expect(host.msgs.single.content, 'Hi');
    await tester.pump(const Duration(seconds: 11));
    expect(host.msgs.single.content, kAiErrorSentinel);
  });

  testWidgets('another member\'s silent bubble is removed on timeout',
      (tester) async {
    final host = _Host([]);
    final h = ChatAiStreamHandler(
        readState: host.read,
        writeMessages: host.write,
        currentUserId: () => 'me',
        conversationId: 'c1');
    h.onStreamEvent({
      'type': 'AI_STREAM_CHUNK',
      'replyId': 'r9',
      'requesterId': 'bob',
      'chunk': 'Thinking…',
    });
    expect(host.msgs.single.id, 'ai-stream-r9');
    expect(host.msgs.single.conversationId, 'c1');
    expect(host.msgs.single.content, 'Thinking…');
    await tester.pump(const Duration(seconds: 31));
    expect(host.msgs, isEmpty);
  });

  testWidgets('cancelPending drops the slot so no timeout fires',
      (tester) async {
    final host = _Host([_bubble('p1')]);
    final h = ChatAiStreamHandler(readState: host.read, writeMessages: host.write);
    h.beginPending('p1');
    h.cancelPending('p1');
    expect(h.slots, isEmpty);
    await tester.pump(const Duration(seconds: 31));
    expect(host.msgs.single.content, '');
  });

  testWidgets('a timeout after the bubble was removed is a no-op',
      (tester) async {
    final host = _Host([_bubble('p1')]);
    final h = ChatAiStreamHandler(readState: host.read, writeMessages: host.write);
    h.beginPending('p1');
    host.write([]);
    await tester.pump(const Duration(seconds: 31));
    expect(host.msgs, isEmpty);
    expect(h.slots, isEmpty);
  });

  test('legacy event without replyId adopts the streaming bubble', () {
    final host = _Host([_bubble('legacy')]);
    final h = ChatAiStreamHandler(readState: host.read, writeMessages: host.write);
    h.onStreamEvent({'type': 'AI_STREAM_CHUNK', 'chunk': 'ok'});
    expect(host.msgs.single.content, 'ok');
    expect(h.slots.single.localId, 'legacy');
    h.dispose();
    expect(h.slots, isEmpty);
  });

  test('no tracked or streaming bubble → legacy event ignored', () {
    final host = _Host([_bubble('done', streaming: false)]);
    final h = ChatAiStreamHandler(readState: host.read, writeMessages: host.write);
    h.onStreamEvent({'type': 'AI_STREAM_CHUNK', 'chunk': 'x'});
    expect(host.msgs.single.content, '');
    expect(h.slots, isEmpty);
  });

  test('sensitive tool calls are tracked once; empty names ignored', () {
    final host = _Host([_bubble('p1')]);
    final h = ChatAiStreamHandler(readState: host.read, writeMessages: host.write);
    h.beginPending('p1');
    h.onStreamEvent({'type': 'AI_TOOL_CALL', 'toolName': 'send_email', 'sensitive': true});
    h.onStreamEvent({'type': 'AI_TOOL_CALL', 'toolName': 'send_email', 'sensitive': true});
    h.onStreamEvent({'type': 'AI_TOOL_CALL', 'toolName': ''});
    final m = host.msgs.single;
    expect(m.activeTools, ['send_email', 'send_email']);
    expect(m.sensitiveTools, ['send_email']);
    h.dispose();
  });

  test('AI_ACTION_PENDING adds the action card to the bubble', () {
    final host = _Host([_bubble('p1')]);
    final h = ChatAiStreamHandler(readState: host.read, writeMessages: host.write);
    h.beginPending('p1');
    h.onStreamEvent({
      'type': 'AI_ACTION_PENDING',
      'requesterId': 'me',
      'action': {'id': 'a1', 'toolName': 'mcp__gmail__send', 'summary': {'kind': 'send_email'}},
    });
    final actions = host.msgs.single.pendingActions!;
    expect(actions.single.id, 'a1');
    expect(actions.single.requesterId, 'me');
    // A malformed action is ignored.
    h.onStreamEvent({'type': 'AI_ACTION_PENDING', 'action': {'id': ''}});
    expect(host.msgs.single.pendingActions!.length, 1);
    h.dispose();
  });

  test('a done reply id is never re-bound by a late duplicate', () {
    final host = _Host([_bubble('p1')]);
    final h = ChatAiStreamHandler(
        readState: host.read, writeMessages: host.write, currentUserId: () => 'me');
    h.beginPending('p1');
    h.onStreamEvent({'type': 'AI_STREAM_CHUNK', 'replyId': 'r1', 'requesterId': 'me', 'chunk': 'A'});
    h.onStreamEvent({'type': 'AI_STREAM_ERROR', 'replyId': 'r1', 'code': 'AI_UNAVAILABLE'});
    host.write([...host.msgs, _bubble('p2')]);
    h.beginPending('p2');
    h.onStreamEvent({'type': 'AI_STREAM_CHUNK', 'replyId': 'r1', 'requesterId': 'me', 'chunk': 'late'});
    expect(host.msgs.firstWhere((m) => m.id == 'p2').content, '');
    h.dispose();
  });
}
