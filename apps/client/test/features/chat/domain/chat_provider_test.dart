// ChatNotifier core (chat_provider.dart): initial load, read receipts, realtime
// events routed by conversation, reconnect catch-up, typing indicator, dispose.

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:platform_client/features/chat/domain/ai_persona_model.dart';
import 'package:platform_client/features/chat/domain/chat_provider.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';

import 'chat_notifier_harness.dart';

void main() {
  setUpAll(() {
    registerFallbackValue(DateTime(2024));
  });

  group('build — initial load', () {
    test('loads history, hasMore, pinned and persona; subscribes the topic',
        () async {
      final h = await ChatHarness.create(
        initial: [msg('m2'), msg('m1')],
        hasNext: true,
        conv: conversation(pinned: [pinnedOf('m1')]),
        aiPersona: const AiPersonaModel(
            conversationId: kConv, name: 'Jarvis', tone: 'friendly'),
      );
      addTearDown(h.dispose);

      expect(h.ids, ['m2', 'm1']);
      expect(h.state.hasMore, isTrue);
      expect(h.state.pinnedMessages.map((p) => p.id), ['m1']);
      expect(h.state.aiPersonaName, 'Jarvis');
      expect(h.stomp.subscribed, [kConv]);
    });

    test('persona fetch failure degrades to the default persona name',
        () async {
      final h = await ChatHarness.create(personaError: Exception('boom'));
      addTearDown(h.dispose);
      expect(h.state.aiPersonaName, 'PON AI');
      expect(h.state.aiPersonaAvatarUrl, isNull);
    });

    test('a failing history fetch surfaces as AsyncError (not empty data)',
        () async {
      // Build a harness first to reuse wiring, then rebuild with failure.
      final h = await ChatHarness.create();
      addTearDown(h.dispose);
      when(() => h.repo.getMessages(kConv, size: 20))
          .thenThrow(Exception('net'));
      h.container.invalidate(chatNotifierProvider(kConv));
      await expectLater(
          h.container.read(chatNotifierProvider(kConv).future), throwsException);
    });

    test('marks unread messages from others read over STOMP when connected',
        () async {
      final h = await ChatHarness.create(initial: [
        msg('mine', sender: kMe),
        msg('already', readBy: [kMe]),
        msg('unread'),
      ]);
      addTearDown(h.dispose);
      expect(h.stomp.sentReads, ['$kConv/unread']);
      verifyNever(() => h.repo.markAsRead(any()));
    });

    test('falls back to REST markAsRead when the socket is down', () async {
      final h = await ChatHarness.create(
          initial: [msg('unread')], connected: false);
      addTearDown(h.dispose);
      expect(h.stomp.sentReads, isEmpty);
      verify(() => h.repo.markAsRead('unread')).called(1);
    });

    test('logged out → nothing is marked read', () async {
      final h = await ChatHarness.create(initial: [msg('unread')], userId: null);
      addTearDown(h.dispose);
      expect(h.stomp.sentReads, isEmpty);
      verifyNever(() => h.repo.markAsRead(any()));
    });

    test('dispose unsubscribes the conversation topic', () async {
      final h = await ChatHarness.create();
      h.dispose();
      expect(h.stomp.unsubscribed, [kConv]);
    });
  });

  group('realtime events', () {
    test('new message from another conversation is ignored', () async {
      final h = await ChatHarness.create(initial: [msg('m1')]);
      addTearDown(h.dispose);
      h.stomp.messagesCtrl.add(msg('x1', conversationId: 'other-conv'));
      await settle();
      expect(h.ids, ['m1']);
    });

    test('new message from someone else is prepended and marked read',
        () async {
      final h = await ChatHarness.create(initial: [msg('m1', readBy: [kMe])]);
      addTearDown(h.dispose);
      h.stomp.messagesCtrl.add(msg('m2'));
      await settle();
      expect(h.ids, ['m2', 'm1']);
      expect(h.stomp.sentReads, ['$kConv/m2']);
    });

    test('own message echo is not marked read; REST read when offline',
        () async {
      final h = await ChatHarness.create(connected: false);
      addTearDown(h.dispose);
      h.stomp.messagesCtrl.add(msg('mine', sender: kMe));
      h.stomp.messagesCtrl.add(msg('theirs'));
      await settle();
      verify(() => h.repo.markAsRead('theirs')).called(1);
      verifyNever(() => h.repo.markAsRead('mine'));
    });

    test('duplicate delivery of the same id never shows twice', () async {
      final h = await ChatHarness.create();
      addTearDown(h.dispose);
      h.stomp.messagesCtrl.add(msg('m1', content: 'a'));
      h.stomp.messagesCtrl.add(msg('m1', content: 'a'));
      await settle();
      expect(h.ids, ['m1']);
    });

    test('read receipt / reaction / edit update only the target message',
        () async {
      final h = await ChatHarness.create(
          initial: [msg('m2', sender: kMe), msg('m1', sender: kMe)]);
      addTearDown(h.dispose);
      h.stomp.readCtrl.add(const ReadReceiptEvent(
          conversationId: kConv, messageId: 'm1', readerId: 'other'));
      h.stomp.reactionCtrl.add(const ReactionUpdateEvent(
          conversationId: kConv,
          messageId: 'm2',
          reactions: [ReactionModel(userId: 'other', emoji: '❤️')]));
      h.stomp.editCtrl.add(MessageUpdateEvent(
          conversationId: kConv,
          messageId: 'm2',
          content: 'edited',
          editedAt: DateTime(2024, 2)));
      await settle();
      final m1 = h.state.messages.firstWhere((m) => m.id == 'm1');
      final m2 = h.state.messages.firstWhere((m) => m.id == 'm2');
      expect(m1.readBy, contains('other'));
      expect(m1.reactions, isEmpty);
      expect(m2.reactions.single.emoji, '❤️');
      expect(m2.content, 'edited');
      expect(m1.content, 'hi');
    });

    test('events for another conversation never touch this one', () async {
      final h = await ChatHarness.create(initial: [msg('m1', sender: kMe)]);
      addTearDown(h.dispose);
      h.stomp.readCtrl.add(const ReadReceiptEvent(
          conversationId: 'c2', messageId: 'm1', readerId: 'other'));
      h.stomp.recallCtrl
          .add(const RecallEvent(conversationId: 'c2', messageId: 'm1'));
      await settle();
      expect(h.state.messages.single.readBy, isEmpty);
      expect(h.state.messages.single.recalled, isFalse);
    });

    test('recall marks the message recalled and drops it from pinned',
        () async {
      final h = await ChatHarness.create(
        initial: [msg('m1')],
        conv: conversation(pinned: [pinnedOf('m1'), pinnedOf('m0')]),
      );
      addTearDown(h.dispose);
      h.stomp.recallCtrl
          .add(const RecallEvent(conversationId: kConv, messageId: 'm1'));
      await settle();
      expect(h.state.messages.single.recalled, isTrue);
      expect(h.state.pinnedMessages.map((p) => p.id), ['m0']);
    });

    test('PINNED_MESSAGE rebuilds pinned list from loaded + previous',
        () async {
      final h = await ChatHarness.create(
        initial: [msg('m2', content: 'loaded')],
        conv: conversation(pinned: [pinnedOf('old')]),
      );
      addTearDown(h.dispose);
      h.stomp.pinCtrl.add(const PinnedMessageEvent(
          conversationId: kConv, pinnedMessageIds: ['m2', 'old']));
      await settle();
      expect(h.state.pinnedMessages.map((p) => p.id), ['m2', 'old']);
      expect(h.state.pinnedMessages.first.content, 'loaded');
    });
  });

  group('typing indicator', () {
    test('other user typing shows, auto-clears after 3s; own echo ignored',
        () {
      fakeAsync((fa) {
        late ChatHarness h;
        ChatHarness.create().then((v) => h = v);
        fa.flushMicrotasks();

        h.stomp.typingCtrl.add(const TypingEvent(
            userId: kMe, conversationId: kConv, isTyping: true));
        h.stomp.typingCtrl.add(const TypingEvent(
            userId: 'bob', conversationId: kConv, isTyping: true));
        fa.flushMicrotasks();
        expect(h.state.typingUserIds, {'bob'});

        fa.elapse(const Duration(seconds: 2));
        expect(h.state.typingUserIds, {'bob'});
        fa.elapse(const Duration(seconds: 2));
        expect(h.state.typingUserIds, isEmpty);
        h.dispose();
      });
    });

    test('explicit stop removes the user immediately', () async {
      final h = await ChatHarness.create();
      addTearDown(h.dispose);
      h.stomp.typingCtrl.add(const TypingEvent(
          userId: 'bob', conversationId: kConv, isTyping: true));
      await settle();
      h.stomp.typingCtrl.add(const TypingEvent(
          userId: 'bob', conversationId: kConv, isTyping: false));
      await settle();
      expect(h.state.typingUserIds, isEmpty);
    });

    test('startTyping sends true then false after 3s idle', () {
      fakeAsync((fa) {
        late ChatHarness h;
        ChatHarness.create().then((v) => h = v);
        fa.flushMicrotasks();
        h.notifier.startTyping();
        fa.elapse(const Duration(seconds: 1));
        h.notifier.startTyping(); // restarts the idle timer
        fa.elapse(const Duration(seconds: 2));
        expect(h.stomp.sentTyping, [true, true]);
        fa.elapse(const Duration(seconds: 2));
        expect(h.stomp.sentTyping, [true, true, false]);
        h.dispose();
      });
    });
  });

  group('reconnect catch-up', () {
    test('pages from the newest confirmed message and merges without dupes',
        () async {
      final t0 = DateTime(2024, 1, 1, 10);
      final h = await ChatHarness.create(initial: [
        msg('pending_1', sender: kMe, pending: true, at: DateTime(2030)),
        msg('m1', at: t0, readBy: [kMe]),
      ]);
      addTearDown(h.dispose);
      final t1 = DateTime(2024, 1, 1, 11);
      final t2 = DateTime(2024, 1, 1, 12);
      when(() => h.repo.getMessagesSince(kConv, t0, afterId: 'm1'))
          .thenAnswer((_) async => page(
              [msg('m1', at: t0, readBy: [kMe]), msg('m2', at: t1)],
              hasNext: true));
      when(() => h.repo.getMessagesSince(kConv, t1, afterId: 'm2'))
          .thenAnswer((_) async => page([msg('m3', at: t2)]));

      h.stomp.reconnectCtrl.add(null);
      await settle();

      expect(h.ids, ['m3', 'm2', 'pending_1', 'm1']);
      verify(() => h.repo.getMessagesSince(kConv, t0, afterId: 'm1')).called(1);
      verify(() => h.repo.getMessagesSince(kConv, t1, afterId: 'm2')).called(1);
      expect(h.stomp.sentReads, containsAll(['$kConv/m2', '$kConv/m3']));
    });

    test('no confirmed message → no catch-up request', () async {
      final h = await ChatHarness.create(
          initial: [msg('pending_1', sender: kMe, pending: true)]);
      addTearDown(h.dispose);
      h.stomp.reconnectCtrl.add(null);
      await settle();
      verifyNever(() => h.repo.getMessagesSince(any(), any(),
          afterId: any(named: 'afterId')));
    });

    test('catch-up failure is non-fatal and the next reconnect retries',
        () async {
      final h = await ChatHarness.create(initial: [msg('m1', readBy: [kMe])]);
      addTearDown(h.dispose);
      when(() => h.repo.getMessagesSince(kConv, any(),
              afterId: any(named: 'afterId')))
          .thenThrow(Exception('offline'));
      h.stomp.reconnectCtrl.add(null);
      await settle();
      expect(h.ids, ['m1']);
      h.stomp.reconnectCtrl.add(null);
      await settle();
      verify(() => h.repo.getMessagesSince(kConv, any(),
          afterId: any(named: 'afterId'))).called(2);
    });

    test('empty page stops paging', () async {
      final h = await ChatHarness.create(initial: [msg('m1', readBy: [kMe])]);
      addTearDown(h.dispose);
      when(() => h.repo.getMessagesSince(kConv, any(),
              afterId: any(named: 'afterId')))
          .thenAnswer((_) async => page([], hasNext: true));
      h.stomp.reconnectCtrl.add(null);
      await settle();
      verify(() => h.repo.getMessagesSince(kConv, any(),
          afterId: any(named: 'afterId'))).called(1);
    });
  });
}
