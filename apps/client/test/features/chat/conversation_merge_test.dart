// CONVERSATION_UPDATED is MERGED, never copied wholesale: the shared topic
// payload carries no viewer state, so a member's mute / archive / block /
// unread can no longer leak onto everyone else's list (HANDOFF §5.3).

import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/domain/conversation_list_ops.dart';

ConversationModel _conv(
  String id, {
  List<String> participants = const ['me', 'bob'],
  bool isMuted = false,
  bool isArchived = false,
  int unread = 0,
  DateTime? lastAt,
  String? name,
}) =>
    ConversationModel(
      id: id,
      type: 'group',
      name: name,
      participants: participants,
      unreadCount: unread,
      createdAt: DateTime(2024),
      lastMessageAt: lastAt,
      isMuted: isMuted,
      isArchived: isArchived,
    );

Map<String, dynamic> _shared(String id,
        {List<String> participants = const ['me', 'bob'],
        String name = 'Renamed',
        List<String> admins = const []}) =>
    {
      'id': id,
      'type': 'group',
      'name': name,
      'participants': participants,
      'admins': admins,
      'createdAt': '2024-01-01T00:00:00Z',
      'lastMessage': {
        'content': '',
        'senderId': 'bob',
        'createdAt': '2024-01-02T00:00:00Z',
        'messageId': 'm9',
        'type': 'text',
        'recalled': true,
      },
      'lastMessageAt': '2024-01-02T00:00:00Z',
      'pinnedMessages': <dynamic>[],
      'pendingMembers': <dynamic>[],
    };

void main() {
  group('ConversationModel.mergeJson', () {
    test('shared payload updates shared fields and keeps MY viewer state', () {
      final mine = _conv('c1', isMuted: true, isArchived: true, unread: 4);
      final merged = mine.mergeJson(_shared('c1', admins: ['bob']));
      expect(merged.name, 'Renamed');
      expect(merged.admins, ['bob']);
      expect(merged.isMuted, isTrue);
      expect(merged.isArchived, isTrue);
      expect(merged.unreadCount, 4);
      // lastMessage is shared (a recall refreshes it for everyone).
      expect(merged.lastMessage?.recalled, isTrue);
    });

    test('a personal (full) view replaces the viewer state', () {
      final mine = _conv('c1', isMuted: true, unread: 4);
      final merged = mine.mergeJson({
        ..._shared('c1'),
        'isMuted': false,
        'isArchived': false,
        'unreadCount': 0,
      });
      expect(merged.isMuted, isFalse);
      expect(merged.unreadCount, 0);
      expect(merged.muteExpiresAt, isNull);
    });
  });

  group('ConversationListOps.merge', () {
    test('drops the conversation when I am no longer a participant', () {
      final res = ConversationListOps.merge(
        [_conv('c1'), _conv('c2')],
        ConversationUpdateEvent(
            json: _shared('c1', participants: ['bob']), personal: false),
        currentUserId: 'me',
      );
      expect(res.outcome, ConversationMergeOutcome.removedMe);
      expect(res.conversations.map((c) => c.id), ['c2']);
    });

    test('an unknown conversation asks the caller to fetch it', () {
      final res = ConversationListOps.merge(
        [_conv('c1')],
        ConversationUpdateEvent(json: _shared('c7'), personal: false),
        currentUserId: 'me',
      );
      expect(res.outcome, ConversationMergeOutcome.unknown);
      expect(res.conversationId, 'c7');
    });

    test('merges in place', () {
      final res = ConversationListOps.merge(
        [_conv('c1', isMuted: true)],
        ConversationUpdateEvent(json: _shared('c1'), personal: false),
        currentUserId: 'me',
      );
      expect(res.outcome, ConversationMergeOutcome.updated);
      expect(res.conversations.single.name, 'Renamed');
      expect(res.conversations.single.isMuted, isTrue);
    });
  });

  group('ConversationListOps.applyIncomingMessage', () {
    test('bumps to the front and counts unread when not viewing', () {
      final out = ConversationListOps.applyIncomingMessage(
        [_conv('a'), _conv('b', unread: 1)],
        conversationId: 'b',
        senderId: 'bob',
        viewing: false,
        content: 'hi',
        messageType: 'text',
      )!;
      expect(out.map((c) => c.id), ['b', 'a']);
      expect(out.first.unreadCount, 2);
      expect(out.first.lastMessage?.type, 'text');
    });

    test('no unread badge for the conversation being viewed', () {
      final out = ConversationListOps.applyIncomingMessage(
        [_conv('a', unread: 0)],
        conversationId: 'a',
        senderId: 'bob',
        viewing: true,
        content: 'hi',
      )!;
      expect(out.single.unreadCount, 0);
    });

    test('returns null for a conversation outside the list', () {
      expect(
        ConversationListOps.applyIncomingMessage([_conv('a')],
            conversationId: 'zz', senderId: 'bob', viewing: false),
        isNull,
      );
    });
  });

  test('upsertSorted keeps the list ordered by activity', () {
    final list = [
      _conv('new', lastAt: DateTime(2024, 3)),
      _conv('old', lastAt: DateTime(2024, 1)),
    ];
    final out = ConversationListOps.upsertSorted(
        list, _conv('mid', lastAt: DateTime(2024, 2)));
    expect(out.map((c) => c.id), ['new', 'mid', 'old']);
  });

  test('canManage: admins only in groups, both people in a DM', () {
    final group = ConversationModel(
      id: 'g',
      type: 'group',
      participants: const ['me', 'bob'],
      admins: const ['bob'],
      unreadCount: 0,
      createdAt: DateTime(2024),
    );
    final dm = ConversationModel(
      id: 'd',
      participants: const ['me', 'bob'],
      unreadCount: 0,
      createdAt: DateTime(2024),
    );
    expect(group.canManage('me'), isFalse);
    expect(group.canManage('bob'), isTrue);
    expect(dm.canManage('me'), isTrue);
  });
}
