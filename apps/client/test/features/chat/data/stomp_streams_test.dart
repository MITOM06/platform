// StompStreams: routing of raw conversation / user-queue / typing / presence
// frames onto typed streams, and dropping malformed frames.

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/stomp_streams.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';

Future<List<T>> _collect<T>(Stream<T> s, void Function() act) async {
  final out = <T>[];
  final sub = s.listen(out.add);
  act();
  await Future<void>.delayed(Duration.zero);
  await sub.cancel();
  return out;
}

void main() {
  late StompStreams s;
  setUp(() => s = StompStreams());

  test('decode: JSON objects only', () {
    expect(StompStreams.decode('{"a":1}'), {'a': 1});
    expect(StompStreams.decode('[1]'), isNull);
    expect(StompStreams.decode('not json'), isNull);
    expect(StompStreams.decode(''), isNull);
    expect(StompStreams.decode(null), isNull);
  });

  test('call.* events go to callEvents', () async {
    final got = await _collect(s.callEventCtrl.stream,
        () => s.routeConversationFrame('c1', {'event': 'call.started', 'callId': 'k'}));
    expect(got.single['callId'], 'k');
  });

  test('reactions are parsed with the topic conversation id', () async {
    final got = await _collect<ReactionUpdateEvent>(s.reactionCtrl.stream, () {
      s.routeConversationFrame('c1', {
        'type': 'REACTION_UPDATED',
        'messageId': 'm1',
        'reactions': [
          {'userId': 'u1', 'emoji': '👍'}
        ],
      });
      s.routeConversationFrame(
          'c1', {'type': 'REACTION_UPDATED', 'messageId': 'm2'});
    });
    expect(got.length, 2);
    expect(got[0].conversationId, 'c1');
    expect(got[0].messageId, 'm1');
    expect(got[0].reactions.single.emoji, '👍');
    expect(got[1].reactions, isEmpty);
  });

  test('recall and pinned messages', () async {
    final recalls = await _collect<RecallEvent>(s.recallCtrl.stream, () =>
        s.routeConversationFrame('c1', {'type': 'MESSAGE_RECALLED', 'messageId': 'm9'}));
    expect(recalls.single.messageId, 'm9');
    expect(recalls.single.conversationId, 'c1');

    final pins = await _collect<PinnedMessageEvent>(s.pinCtrl.stream, () {
      s.routeConversationFrame('c1', {
        'type': 'PINNED_MESSAGE',
        'conversationId': 'c2',
        'pinnedMessages': ['a', 'b'],
      });
      s.routeConversationFrame('c1', {'type': 'PINNED_MESSAGE'});
    });
    expect(pins[0].conversationId, 'c2');
    expect(pins[0].pinnedMessageIds, ['a', 'b']);
    expect(pins[1].conversationId, 'c1');
    expect(pins[1].pinnedMessageIds, isEmpty);
  });

  test('KB status updates and AI events (conversation id filled in)',
      () async {
    final kb = await _collect(s.kbStatusCtrl.stream, () =>
        s.routeConversationFrame('c1', {'type': 'KB_STATUS_UPDATE', 'documentId': 'd'}));
    expect(kb.single['documentId'], 'd');

    final ai = await _collect(s.aiStreamCtrl.stream, () =>
        s.routeConversationFrame('c1', {'type': 'AI_STREAM_CHUNK', 'replyId': 'r'}));
    expect(ai.single, {'conversationId': 'c1', 'type': 'AI_STREAM_CHUNK', 'replyId': 'r'});
  });

  test('unknown UPPER_SNAKE events and malformed frames never become messages',
      () async {
    final msgs = await _collect<MessageModel>(s.messageCtrl.stream, () {
      s.routeConversationFrame('c1', {'type': 'SOMETHING_NEW'});
      s.routeConversationFrame('c1', {'type': 'MESSAGE_RECALLED'}); // no id
    });
    expect(msgs, isEmpty);
  });

  test('CONVERSATION_UPDATED: topic = shared, user queue = personal',
      () async {
    final got = await _collect<ConversationUpdateEvent>(s.convUpdateCtrl.stream, () {
      s.routeConversationFrame('c1', {
        'type': 'CONVERSATION_UPDATED',
        'conversation': {'id': 'c1'}
      });
      s.routeConversationFrame(
          'c1', {'type': 'CONVERSATION_UPDATED', 'conversation': 'bad'});
      s.routeUserQueueFrame({
        'type': 'CONVERSATION_UPDATED',
        'conversation': {'id': 'c2'}
      });
      s.routeUserQueueFrame({'type': 'CONVERSATION_UPDATED'});
    });
    expect(got.length, 2);
    expect(got[0].personal, isFalse);
    expect(got[0].json['id'], 'c1');
    expect(got[1].personal, isTrue);
    expect(got[1].json['id'], 'c2');
  });

  test('other user-queue frames go to notifications', () async {
    final got = await _collect(s.notifCtrl.stream,
        () => s.routeUserQueueFrame({'type': 'CLAIMS_CHANGED'}));
    expect(got.single['type'], 'CLAIMS_CHANGED');
  });

  test('typing and presence need a string userId', () async {
    final typing = await _collect<TypingEvent>(s.typingCtrl.stream, () {
      s.routeTypingFrame('c1', {'userId': 'u1', 'typing': true});
      s.routeTypingFrame('c1', {'userId': 'u2'});
      s.routeTypingFrame('c1', {'userId': 3});
    });
    expect(typing.length, 2);
    expect(typing[0].isTyping, isTrue);
    expect(typing[1].isTyping, isFalse);
    expect(typing[0].conversationId, 'c1');

    final presence = await _collect<PresenceEvent>(s.presenceCtrl.stream, () {
      s.routePresenceFrame({'userId': 'u1', 'online': true});
      s.routePresenceFrame({'userId': 'u2'});
      s.routePresenceFrame({'online': true});
    });
    expect(presence.map((p) => (p.userId, p.online)),
        [('u1', true), ('u2', false)]);
  });
}
