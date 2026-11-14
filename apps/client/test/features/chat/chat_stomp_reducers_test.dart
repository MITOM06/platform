// Pure-logic tests for ChatStompReducers — the list transforms that apply
// realtime STOMP events (read receipt, reaction, recall, edit, pinned) and the
// reconcileNewMessage placeholder-swapping logic. These run with no Flutter /
// STOMP / Dio dependencies. They guard the realtime pipeline that must stay in
// sync with web (see docs/engineering/sync.md).

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
      final res = ChatStompReducers.reconcileNewMessage(msgs, incoming);
      expect(res.first.id, 'new');
      expect(res, hasLength(2));
    });

    test('replaces the optimistic pending message with the persisted one', () {
      final pending = _m('pending_123',
          content: 'hi there', senderId: 'me', isPending: true);
      final msgs = [pending, _m('older')];
      final persisted = _m('real-id', content: 'hi there', senderId: 'me');

      final res = ChatStompReducers.reconcileNewMessage(msgs, persisted);

      expect(res.map((m) => m.id), contains('real-id'));
      expect(res.map((m) => m.id), isNot(contains('pending_123')));
      expect(res, hasLength(2)); // swapped, not appended
    });

    test('never shows the same server message twice (dedupe by id)', () {
      // e.g. the REST send response landed first, then the STOMP echo; or a
      // catch-up page raced the live frame.
      final msgs = [_m('m1', content: 'v1'), _m('older')];
      final res = ChatStompReducers.reconcileNewMessage(
          msgs, _m('m1', content: 'v1'));
      expect(res.where((m) => m.id == 'm1'), hasLength(1));
      expect(res, hasLength(2));
    });

    test('does not swap a pending message of another type', () {
      final pending = _m('pending_1',
          content: '👍', senderId: 'me', isPending: true, type: 'sticker');
      final res = ChatStompReducers.reconcileNewMessage(
          [pending], _m('real', content: '👍', senderId: 'me'));
      expect(res, hasLength(2));
    });
  });

  group('catch-up helpers', () {
    test('newestConfirmed skips optimistic sends and AI placeholders', () {
      final msgs = [
        _m('ai-pending-1', type: 'ai', senderId: kAiBotUserId, isStreaming: true),
        _m('pending_9', isPending: true),
        _m('real-2'),
        _m('real-1'),
      ];
      expect(ChatStompReducers.newestConfirmed(msgs)?.id, 'real-2');
    });

    test('mergeCatchup adds oldest-first pages newest-first, skipping dupes', () {
      final msgs = [_m('b'), _m('a')];
      final out = ChatStompReducers.mergeCatchup(msgs, [_m('b'), _m('c'), _m('d')]);
      expect(out.map((m) => m.id), ['d', 'c', 'b', 'a']);
    });
  });

  group('quotes follow recall / edit', () {
    MessageModel reply(String quotedId, String quoted) => MessageModel(
          id: 'r',
          conversationId: 'c-1',
          senderId: 'u2',
          content: 'answer',
          type: 'text',
          readBy: const [],
          createdAt: DateTime(2024, 1, 2),
          replyToId: quotedId,
          replyPreview:
              ReplyPreview(messageId: quotedId, senderId: 'u1', content: quoted),
        );

    test('a recall blanks every quote of the recalled message', () {
      final out = ChatStompReducers.applyRecall(
        [reply('m1', 'secret'), _m('m1', content: 'secret')],
        const RecallEvent(conversationId: 'c-1', messageId: 'm1'),
      );
      final quote = out.first.replyPreview!;
      expect(quote.recalled, isTrue);
      expect(quote.content, isEmpty);
      expect(out.last.recalled, isTrue);
    });

    test('MESSAGE_UPDATED without editedAt (AI action status) is not an edit',
        () {
      final out = ChatStompReducers.applyEdit(
        [_m('m1', content: 'answer')],
        const MessageUpdateEvent(
          conversationId: 'c-1',
          messageId: 'm1',
          content: 'answer',
          pendingActions: [],
        ),
      );
      expect(out.single.isEdited, isFalse);
      expect(out.single.content, 'answer');
    });
  });

  group('edits reach quotes and pending-action cards', () {
    MessageModel replyTo(String id, {bool recalled = false}) => MessageModel(
          id: 'r-$id',
          conversationId: 'c-1',
          senderId: 'u2',
          content: 'answer',
          type: 'text',
          readBy: const [],
          createdAt: DateTime(2024, 1, 2),
          replyToId: id,
          replyPreview: ReplyPreview(
              messageId: id, senderId: 'u1', content: 'old', recalled: recalled),
        );

    test('an edit rewrites the quote of the edited message', () {
      final out = ChatStompReducers.applyEdit(
        [replyTo('m1'), replyTo('m2'), _m('m1', content: 'old')],
        MessageUpdateEvent(
          conversationId: 'c-1',
          messageId: 'm1',
          content: 'new text',
          editedAt: DateTime(2024, 1, 3),
        ),
      );
      expect(out[0].replyPreview!.content, 'new text');
      expect(out[0].replyPreview!.senderId, 'u1');
      expect(out[1].replyPreview!.content, 'old'); // other quote untouched
      expect(out[2].content, 'new text');
      expect(out[2].isEdited, isTrue);
    });

    test('a recalled quote is not revived by a late edit', () {
      final out = ChatStompReducers.applyEdit(
        [replyTo('m1', recalled: true)],
        MessageUpdateEvent(
            conversationId: 'c-1',
            messageId: 'm1',
            content: 'x',
            editedAt: DateTime(2024)),
      );
      expect(out.single.replyPreview!.recalled, isTrue);
      expect(out.single.replyPreview!.content, 'old');
    });

    test('a status update replaces the cards, keeping the known requester', () {
      final ai = _m('a1', type: 'ai').copyWith(pendingActions: const [
        AiPendingAction(id: 'x', requesterId: 'me'),
      ]);
      final out = ChatStompReducers.applyEdit(
        [ai],
        const MessageUpdateEvent(
          conversationId: 'c-1',
          messageId: 'a1',
          pendingActions: [
            AiPendingAction(id: 'x', status: AiActionStatus.confirmed)
          ],
        ),
      );
      final a = out.single.pendingActions!.single;
      expect(a.status, AiActionStatus.confirmed);
      expect(a.requesterId, 'me');
    });

    test('a re-delivered message merges server cards into the existing copy',
        () {
      final existing = _m('m9', type: 'ai').copyWith(pendingActions: const [
        AiPendingAction(id: 'x', requesterId: 'me'),
      ]);
      final incoming = _m('m9', type: 'ai', content: 'final').copyWith(
          pendingActions: const [
            AiPendingAction(id: 'x', status: AiActionStatus.failed)
          ]);
      final out = ChatStompReducers.reconcileNewMessage([existing], incoming);
      expect(out.single.content, 'final');
      expect(out.single.pendingActions!.single.status, AiActionStatus.failed);
      expect(out.single.pendingActions!.single.requesterId, 'me');

      // Without cards in the new copy the existing ones are kept.
      final kept = ChatStompReducers.reconcileNewMessage(
          [existing], _m('m9', type: 'ai', content: 'v2'));
      expect(kept.single.pendingActions!.single.requesterId, 'me');
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
