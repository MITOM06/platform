// Parsing / derived getters of chat models not covered elsewhere: reply
// previews, collages, AI reply ids, pinned messages, link previews, statuses.

import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/call_signal_port.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';

class _Stomp extends StompService {
  final raw = <(String, Map<String, dynamic>)>[];
  final subs = <String>[], unsubs = <String>[];
  final events = StreamController<Map<String, dynamic>>.broadcast();
  @override
  void build() {}
  @override
  void sendRawMessage({required String destination, required String body}) =>
      raw.add((destination, jsonDecode(body) as Map<String, dynamic>));
  @override
  void subscribeConversation(String conversationId) => subs.add(conversationId);
  @override
  void unsubscribeConversation(String conversationId) =>
      unsubs.add(conversationId);
  @override
  Stream<Map<String, dynamic>> get callEvents => events.stream;
}

Map<String, dynamic> _msg(Map<String, dynamic> extra) => {
      'id': 'm1',
      'conversationId': 'c1',
      'senderId': 'u1',
      'content': 'hi',
      'type': 'text',
      'createdAt': '2026-01-01T00:00:00Z',
      ...extra,
    };

void main() {
  group('MessageModel.fromJson', () {
    test('reply preview with defaults', () {
      final m = MessageModel.fromJson(_msg({
        'replyToId': 'm0',
        'replyPreview': {'messageId': 'm0', 'content': 'orig'},
      }));
      expect(m.replyToId, 'm0');
      expect(m.replyPreview?.messageId, 'm0');
      expect(m.replyPreview?.content, 'orig');
      expect(m.replyPreview?.senderId, '');
      expect(m.replyPreview?.recalled, isFalse);
    });

    test('aiReplyId only when a non-empty string', () {
      expect(MessageModel.fromJson(_msg({'aiReplyId': 'r1'})).aiReplyId, 'r1');
      expect(MessageModel.fromJson(_msg({'aiReplyId': ''})).aiReplyId, isNull);
      expect(MessageModel.fromJson(_msg({'aiReplyId': 3})).aiReplyId, isNull);
    });

    test('bad dates never throw', () {
      final m = MessageModel.fromJson(
          _msg({'createdAt': 'garbage', 'editedAt': 12}));
      expect(m.editedAt, isNull);
      expect(m.createdAt.difference(DateTime.now()).inMinutes.abs(), lessThan(1));
    });
  });

  test('isMultiImage: only image JSON arrays with more than one URL', () {
    MessageModel img(String content, {String type = 'image'}) =>
        MessageModel.fromJson(_msg({'type': type, 'content': content}));
    expect(img(jsonEncode(['a', 'b'])).isMultiImage, isTrue);
    expect(img(jsonEncode(['a'])).isMultiImage, isFalse);
    expect(img('/api/uploads/a.png').isMultiImage, isFalse);
    expect(img(jsonEncode(['a', 'b']), type: 'text').isMultiImage, isFalse);
  });

  test('LinkPreviewData.hasContent needs a title or an image', () {
    expect(const LinkPreviewData(url: 'u', title: 'T').hasContent, isTrue);
    expect(const LinkPreviewData(url: 'u', image: 'i.png').hasContent, isTrue);
    expect(const LinkPreviewData(url: 'u', title: '', image: '').hasContent,
        isFalse);
    expect(const LinkPreviewData(url: 'u', description: 'd').hasContent, isFalse);
  });

  group('ConversationModel', () {
    Map<String, dynamic> conv(Map<String, dynamic> extra) => {
          'id': 'c1',
          'type': 'group',
          'participants': ['u1', 'u2'],
          'unreadCount': 0,
          'createdAt': '2026-01-01T00:00:00Z',
          ...extra,
        };

    test('pinned messages are parsed with type + date defaults', () {
      final c = ConversationModel.fromJson(conv({
        'pinnedMessages': [
          {
            'id': 'p1',
            'senderId': 'u1',
            'content': 'x',
            'type': 'image',
            'createdAt': '2026-02-02T00:00:00Z'
          },
          {'id': 'p2', 'senderId': 'u2'},
        ]
      }));
      expect(c.pinnedMessages.length, 2);
      expect(c.pinnedMessages[0].type, 'image');
      expect(c.pinnedMessages[0].createdAt, DateTime.utc(2026, 2, 2));
      expect(c.pinnedMessages[1].type, 'text');
      expect(c.pinnedMessages[1].content, '');
      expect(c.pinnedMessages[1].createdAt, isNull);
    });

    test('isPending and isAdmin', () {
      final g = ConversationModel.fromJson(
          conv({'status': 'pending', 'admins': ['u1']}));
      expect(g.isPending, isTrue);
      expect(g.isAdmin('u1'), isTrue);
      expect(g.isAdmin('u2'), isFalse);
      final d = ConversationModel.fromJson(
          conv({'type': 'direct', 'admins': ['u1']}));
      expect(d.isPending, isFalse);
      expect(d.isAdmin('u1'), isFalse); // direct chats have no admins
    });

    test('LastMessageModel tolerates a bad date', () {
      final l = LastMessageModel.fromJson(const {'content': 'x', 'createdAt': 'nope'});
      expect(l.content, 'x');
      expect(l.senderId, '');
      expect(l.recalled, isFalse);
    });
  });

  test('UserStatus.fromJson', () {
    final s = UserStatus.fromJson(
        const {'userId': 'u1', 'online': true, 'lastSeen': '2026-03-01T10:00:00Z'});
    expect(s.online, isTrue);
    expect(s.lastSeen, DateTime.utc(2026, 3, 1, 10));
    final empty = UserStatus.fromJson(const {});
    expect(empty.userId, '');
    expect(empty.online, isFalse);
    expect(empty.lastSeen, isNull);
  });

  test('StompCallSignalPort forwards to the STOMP service', () async {
    final stomp = _Stomp();
    final port = StompCallSignalPort(stomp);
    port.send('/app/call.join', {'callId': 'k'});
    port.holdConversation('c1');
    port.releaseConversation('c1');
    expect(stomp.raw.single.$1, '/app/call.join');
    expect(stomp.raw.single.$2, {'callId': 'k'});
    expect(stomp.subs, ['c1']);
    expect(stomp.unsubs, ['c1']);
    final got = <Map<String, dynamic>>[];
    final sub = port.callEvents.listen(got.add);
    stomp.events.add({'event': 'call.ended'});
    await Future<void>.delayed(Duration.zero);
    await sub.cancel();
    expect(got.single['event'], 'call.ended');
  });
}
