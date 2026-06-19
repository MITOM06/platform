// Pure-logic tests for ChatStompReducers — the list transforms that apply
// realtime STOMP events (read receipt, reaction, recall, edit, pinned) and the
// reconcileNewMessage placeholder-swapping logic. These run with no Flutter /
// STOMP / Dio dependencies. They guard the realtime pipeline that must stay in
// sync with web (see .claude/rules/sync.md).

import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_events.dart';
import 'package:platform_client/features/chat/domain/chat_models.dart';
import 'package:platform_client/features/chat/domain/chat_stomp_reducers.dart';

MessageModel _m(
  String id, {
  String content = 'text',
  String senderId = 'user-1',
  String type = 'text',
  List<String> readBy = const [],
  List<ReactionModel> reactions = const [],
  bool isPending = false,
  bool isStreaming = false,
}) =>
    MessageModel(
      id: id,
      conversationId: 'c-1',
      senderId: senderId,
      content: content,
      type: type,
      readBy: readBy,
      reactions: reactions,
      isPending: isPending,
      isStreaming: isStreaming,
      createdAt: DateTime(2024, 1, 1),
    );

void main() {
  group('applyReadReceipt', () {
    test('adds the reader to the matching message only, once', () {
      final msgs = [_m('a'), _m('b')];
      final out = ChatStompReducers.applyReadReceipt(
        msgs,
        const ReadReceiptEvent(
            conversationId: 'c-1', messageId: 'b', readerId: 'u2'),
      );
      expect(out.firstWhere((m) => m.id == 'a').readBy, isEmpty);
      expect(out.firstWhere((m) => m.id == 'b').readBy, ['u2']);
    });

    test('is idempotent — does not duplicate an existing reader', () {
      final msgs = [
        _m('b', readBy: ['u2'])
      ];
      final out = ChatStompReducers.applyReadReceipt(
        msgs,
        const ReadReceiptEvent(
            conversationId: 'c-1', messageId: 'b', readerId: 'u2'),
      );
      expect(out.single.readBy, ['u2']);
    });

    test('does not mutate the input list', () {
      final original = [_m('b')];
      ChatStompReducers.applyReadReceipt(
        original,
        const ReadReceiptEvent(
            conversationId: 'c-1', messageId: 'b', readerId: 'u2'),
      );
      expect(original.single.readBy, isEmpty);
    });
  });

  group('applyReactionUpdate', () {
    test('replaces reactions with the authoritative set', () {
      final msgs = [
        _m('a', reactions: const [ReactionModel(userId: 'u1', emoji: '👍')]),
      ];
      final out = ChatStompReducers.applyReactionUpdate(
        msgs,
        const ReactionUpdateEvent(
          conversationId: 'c-1',
          messageId: 'a',
          reactions: [ReactionModel(userId: 'u2', emoji: '❤️')],
        ),
      );
      expect(out.single.reactions, hasLength(1));
      expect(out.single.reactions.first.emoji, '❤️');
    });
  });

  group('applyRecall', () {
    test('marks recalled and clears content + reactions', () {
      final msgs = [
        _m('a',
            content: 'secret',
            reactions: const [ReactionModel(userId: 'u1', emoji: '👍')]),
      ];
      final out = ChatStompReducers.applyRecall(
        msgs,
        const RecallEvent(conversationId: 'c-1', messageId: 'a'),
      );
      expect(out.single.recalled, isTrue);
      expect(out.single.content, '');
      expect(out.single.reactions, isEmpty);
    });
  });

  group('applyEdit', () {
    test('updates content and editedAt of the matching message', () {
      final editedAt = DateTime(2024, 6, 1, 12);
      final msgs = [_m('a', content: 'old')];
      final out = ChatStompReducers.applyEdit(
        msgs,
        MessageUpdateEvent(
          conversationId: 'c-1',
          messageId: 'a',
          content: 'new',
          editedAt: editedAt,
        ),
      );
      expect(out.single.content, 'new');
      expect(out.single.editedAt, editedAt);
      expect(out.single.isEdited, isTrue);
    });
  });

  group('reconcileNewMessage', () {
    test('prepends a brand-new message when nothing matches', () {
      final msgs = [_m('a')];
      final incoming = _m('new', senderId: 'user-9');
      final res = ChatStompReducers.reconcileNewMessage(
        msgs,
        incoming,
        finalizedAiPlaceholderId: null,
      );
      expect(res.consumedAiPlaceholder, isFalse);
      expect(res.messages.first.id, 'new');
      expect(res.messages, hasLength(2));
    });

    test('replaces the optimistic pending message with the persisted one', () {
      final pending = _m('pending_123',
          content: 'hi there', senderId: 'me', isPending: true);
      final msgs = [pending, _m('older')];
      final persisted = _m('real-id', content: 'hi there', senderId: 'me');

      final res = ChatStompReducers.reconcileNewMessage(
        msgs,
        persisted,
        finalizedAiPlaceholderId: null,
      );

      expect(res.consumedAiPlaceholder, isFalse);
      expect(res.messages.map((m) => m.id), contains('real-id'));
      expect(res.messages.map((m) => m.id), isNot(contains('pending_123')));
      expect(res.messages, hasLength(2)); // swapped, not appended
    });

    test('swaps the exact tracked AI placeholder by id', () {
      final placeholder = _m('ai-pending-xyz',
          type: 'ai', senderId: kAiBotUserId, isStreaming: true);
      final msgs = [placeholder, _m('older')];
      final persistedAi = _m('ai-real', type: 'ai', senderId: kAiBotUserId);

      final res = ChatStompReducers.reconcileNewMessage(
        msgs,
        persistedAi,
        finalizedAiPlaceholderId: 'ai-pending-xyz',
      );

      expect(res.consumedAiPlaceholder, isTrue);
      expect(res.messages.map((m) => m.id), contains('ai-real'));
      expect(res.messages.map((m) => m.id), isNot(contains('ai-pending-xyz')));
      expect(res.messages, hasLength(2));
    });

    test('falls back to heuristic AI placeholder when no id is tracked', () {
      final placeholder = _m('ai-pending-abc',
          type: 'ai', senderId: kAiBotUserId, isStreaming: false);
      final msgs = [placeholder];
      final persistedAi = _m('ai-real', type: 'ai', senderId: kAiBotUserId);

      final res = ChatStompReducers.reconcileNewMessage(
        msgs,
        persistedAi,
        finalizedAiPlaceholderId: null,
      );

      expect(res.consumedAiPlaceholder, isTrue);
      expect(res.messages.single.id, 'ai-real');
    });
  });

  group('buildPinned', () {
    test('builds pinned models from ids, dropping unknown ids in order', () {
      final msgs = [
        _m('p1', content: 'first', senderId: 'u1'),
        _m('p2', content: 'second', senderId: 'u2'),
      ];
      final out = ChatStompReducers.buildPinned(
        msgs,
        const PinnedMessageEvent(
          conversationId: 'c-1',
          pinnedMessageIds: ['p2', 'missing', 'p1'],
        ),
      );
      // 'missing' is not loaded → dropped; order follows the event id order.
      expect(out.map((p) => p.id), ['p2', 'p1']);
      expect(out.first.content, 'second');
    });
  });
}
