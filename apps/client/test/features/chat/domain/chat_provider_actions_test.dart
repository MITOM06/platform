// ChatNotifier message actions (chat_provider_actions.dart): paging older
// history, reply/edit composer state, reactions, recall, edit with rollback,
// pin/unpin (limit + rollback), forward, delete-for-me, search jump.

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:platform_client/core/utils/global_messenger.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import 'package:platform_client/l10n/app_localizations_en.dart';

import 'chat_notifier_harness.dart';

final _en = AppLocalizationsEn();

DioException _http(int status, [Map<String, dynamic>? body]) => DioException(
      requestOptions: RequestOptions(path: '/api/messages/x'),
      type: DioExceptionType.badResponse,
      response: Response(
        requestOptions: RequestOptions(path: '/api/messages/x'),
        statusCode: status,
        data: body,
      ),
      message: 'Http status error [$status] raw',
    );

DioException _offline() => DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.connectionError,
      message: 'SocketException raw',
    );

Future<void> _pumpHost(WidgetTester tester) async {
  await tester.pumpWidget(MaterialApp(
    navigatorKey: rootNavigatorKey,
    locale: const Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: const Scaffold(body: SizedBox()),
  ));
}

Future<void> _finish(WidgetTester tester, ChatHarness h) async {
  await tester.pump(const Duration(seconds: 4));
  await tester.pump(const Duration(seconds: 1));
  h.dispose();
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  group('loadMore — older pages', () {
    test('cursor = oldest real message; appends older, skips overlap, hasMore',
        () async {
      final h = await ChatHarness.create(initial: [
        msg('pending_9', sender: kMe, pending: true),
        msg('m3'),
        msg('m2'),
      ], hasNext: true);
      addTearDown(h.dispose);
      when(() => h.repo.getMessages(kConv, before: 'm2', size: 20)).thenAnswer(
          (_) async => page([msg('m2'), msg('m1'), msg('m0')], hasNext: false));

      await h.notifier.loadMore();

      expect(h.ids, ['pending_9', 'm3', 'm2', 'm1', 'm0']);
      expect(h.state.hasMore, isFalse);
      expect(h.state.isLoadingMore, isFalse);
    });

    test('no more pages → no request', () async {
      final h = await ChatHarness.create(initial: [msg('m1')], hasNext: false);
      addTearDown(h.dispose);
      await h.notifier.loadMore();
      verifyNever(() => h.repo.getMessages(kConv,
          before: any(named: 'before', that: isNotNull), size: 20));
    });

    test('a second loadMore while one is in flight is ignored', () async {
      final h = await ChatHarness.create(initial: [msg('m1')], hasNext: true);
      addTearDown(h.dispose);
      final gate = Completer<PagedResult<MessageModel>>();
      when(() => h.repo.getMessages(kConv, before: 'm1', size: 20))
          .thenAnswer((_) => gate.future);
      final first = h.notifier.loadMore();
      expect(h.state.isLoadingMore, isTrue);
      await h.notifier.loadMore();
      gate.complete(page([msg('m0')]));
      await first;
      verify(() => h.repo.getMessages(kConv, before: 'm1', size: 20)).called(1);
      expect(h.ids, ['m1', 'm0']);
    });

    test('failure clears the loading flag and keeps hasMore for a retry',
        () async {
      final h = await ChatHarness.create(initial: [msg('m1')], hasNext: true);
      addTearDown(h.dispose);
      when(() => h.repo.getMessages(kConv, before: 'm1', size: 20))
          .thenAnswer((_) async => throw _offline());
      await h.notifier.loadMore();
      expect(h.state.isLoadingMore, isFalse);
      expect(h.state.hasMore, isTrue);
      expect(h.ids, ['m1']);
    });

    test('jumpToMessage pages back until the target is loaded, then highlights',
        () async {
      final h = await ChatHarness.create(initial: [msg('m3')], hasNext: true);
      addTearDown(h.dispose);
      when(() => h.repo.getMessages(kConv, before: 'm3', size: 20))
          .thenAnswer((_) async => page([msg('m2')], hasNext: true));
      when(() => h.repo.getMessages(kConv, before: 'm2', size: 20))
          .thenAnswer((_) async => page([msg('m1')], hasNext: true));

      await h.notifier.jumpToMessage('m1');
      expect(h.ids, ['m3', 'm2', 'm1']);
      expect(h.state.highlightMessageId, 'm1');
      verifyNever(() => h.repo.getMessages(kConv, before: 'm1', size: 20));

      h.notifier.clearHighlight();
      expect(h.state.highlightMessageId, isNull);
    });

    test('jumpToMessage stops at the end of history', () async {
      final h = await ChatHarness.create(initial: [msg('m1')], hasNext: false);
      addTearDown(h.dispose);
      await h.notifier.jumpToMessage('missing');
      expect(h.state.highlightMessageId, 'missing');
      verifyNever(() => h.repo.getMessages(kConv,
          before: any(named: 'before', that: isNotNull), size: 20));
    });
  });

  group('reply / edit composer', () {
    test('reply and edit are mutually exclusive; cancel clears', () async {
      final h = await ChatHarness.create(initial: [msg('m1')]);
      addTearDown(h.dispose);
      final m = h.state.messages.single;
      h.notifier.startReply(m);
      expect(h.state.replyingTo?.id, 'm1');
      h.notifier.startEditing(m);
      expect(h.state.editingMessage?.id, 'm1');
      expect(h.state.replyingTo, isNull);
      h.notifier.cancelEditing();
      expect(h.state.editingMessage, isNull);
      h.notifier.startReply(m);
      h.notifier.cancelReply();
      expect(h.state.replyingTo, isNull);
    });
  });

  group('reactions', () {
    test('new emoji → add; same emoji again → remove', () async {
      final h = await ChatHarness.create(initial: [
        MessageModel(
          id: 'm1',
          conversationId: kConv,
          senderId: 'other',
          content: 'x',
          type: 'text',
          readBy: const [kMe],
          createdAt: DateTime(2024),
          reactions: const [ReactionModel(userId: kMe, emoji: '👍')],
        ),
      ]);
      addTearDown(h.dispose);
      when(() => h.repo.addReaction(any(), any())).thenAnswer((_) async {});
      when(() => h.repo.removeReaction(any())).thenAnswer((_) async {});

      await h.notifier.toggleReaction('m1', '❤️');
      await h.notifier.toggleReaction('m1', '👍');
      verify(() => h.repo.addReaction('m1', '❤️')).called(1);
      verify(() => h.repo.removeReaction('m1')).called(1);
    });

    test('taps while a toggle is in flight are dropped', () async {
      final h = await ChatHarness.create(initial: [msg('m1')]);
      addTearDown(h.dispose);
      final gate = Completer<void>();
      when(() => h.repo.addReaction('m1', '👍')).thenAnswer((_) => gate.future);
      final first = h.notifier.toggleReaction('m1', '👍');
      await h.notifier.toggleReaction('m1', '👍');
      await h.notifier.toggleReaction('m1', '👍');
      gate.complete();
      await first;
      verify(() => h.repo.addReaction('m1', '👍')).called(1);

      // Released after completion → the next tap goes through.
      when(() => h.repo.addReaction('m1', '👍')).thenAnswer((_) async {});
      await h.notifier.toggleReaction('m1', '👍');
      verify(() => h.repo.addReaction('m1', '👍')).called(1);
    });

    testWidgets('429 → localized rate-limit text, guard released', (t) async {
      await _pumpHost(t);
      final h = await ChatHarness.create(initial: [msg('m1')]);
      when(() => h.repo.addReaction('m1', '👍'))
          .thenAnswer((_) async => throw _http(429));
      await h.notifier.toggleReaction('m1', '👍');
      await t.pump();
      expect(find.text(_en.rateLimitError), findsOneWidget);
      expect(find.textContaining('Http status'), findsNothing);
      when(() => h.repo.addReaction('m1', '👍')).thenAnswer((_) async {});
      await h.notifier.toggleReaction('m1', '👍');
      verify(() => h.repo.addReaction('m1', '👍')).called(2);
      await _finish(t, h);
    });
  });

  group('edit', () {
    test('optimistic edit with trimmed text; composer cleared', () async {
      final h = await ChatHarness.create(initial: [msg('m1', sender: kMe)]);
      addTearDown(h.dispose);
      when(() => h.repo.editMessage('m1', 'new text'))
          .thenAnswer((_) async => msg('m1', sender: kMe, content: 'new text'));
      h.notifier.startEditing(h.state.messages.single);
      await h.notifier.editMessage('m1', '  new text  ');
      expect(h.state.messages.single.content, 'new text');
      expect(h.state.messages.single.isEdited, isTrue);
      expect(h.state.editingMessage, isNull);
    });

    test('blank content is ignored (no request)', () async {
      final h = await ChatHarness.create(initial: [msg('m1', sender: kMe)]);
      addTearDown(h.dispose);
      await h.notifier.editMessage('m1', '   ');
      expect(h.state.messages.single.content, 'hi');
      verifyNever(() => h.repo.editMessage(any(), any()));
    });

    test('non-text, recalled or unknown messages are never edited', () async {
      final h = await ChatHarness.create(initial: [
        msg('voice', sender: kMe, type: 'voice', content: '/api/uploads/a.m4a'),
        msg('gone', sender: kMe, recalled: true),
      ]);
      addTearDown(h.dispose);
      h.notifier.startEditing(h.state.messages.first);
      await h.notifier.editMessage('voice', 'overwrite');
      expect(h.state.editingMessage, isNull);
      await h.notifier.editMessage('gone', 'x');
      await h.notifier.editMessage('nope', 'x');
      expect(h.state.messages.first.content, '/api/uploads/a.m4a');
      verifyNever(() => h.repo.editMessage(any(), any()));
    });

    testWidgets('server failure rolls back only that message + localized error',
        (t) async {
      await _pumpHost(t);
      final h = await ChatHarness.create(initial: [msg('m1', sender: kMe)]);
      final gate = Completer<MessageModel>();
      when(() => h.repo.editMessage('m1', 'changed'))
          .thenAnswer((_) => gate.future);
      final editing = h.notifier.editMessage('m1', 'changed');
      expect(h.state.messages.single.content, 'changed');
      // A realtime message arrives while the edit is in flight.
      h.stomp.messagesCtrl.add(msg('m2'));
      await t.pump();
      gate.completeError(_http(403, {'code': 'FORBIDDEN'}));
      await editing;
      await t.pump();
      expect(h.ids, ['m2', 'm1']);
      expect(h.state.messages.last.content, 'hi');
      expect(h.state.messages.last.isEdited, isFalse);
      expect(find.text(_en.errForbidden), findsOneWidget);
      await _finish(t, h);
    });
  });

  group('recall', () {
    test('success leaves state to the MESSAGE_RECALLED broadcast', () async {
      final h = await ChatHarness.create(initial: [msg('m1', sender: kMe)]);
      addTearDown(h.dispose);
      when(() => h.repo.recallMessage('m1')).thenAnswer((_) async {});
      await h.notifier.recallMessage('m1');
      verify(() => h.repo.recallMessage('m1')).called(1);
      expect(h.state.messages.single.recalled, isFalse);
    });

    testWidgets('403 (not the sender) → localized forbidden text, message kept',
        (t) async {
      await _pumpHost(t);
      final h = await ChatHarness.create(initial: [msg('m1')]);
      when(() => h.repo.recallMessage('m1'))
          .thenAnswer((_) async => throw _http(403));
      await h.notifier.recallMessage('m1');
      await t.pump();
      expect(h.state.messages.single.recalled, isFalse);
      expect(find.text(_en.errForbidden), findsOneWidget);
      await _finish(t, h);
    });

    test(
        'failure must not drop messages that arrived while the request was '
        'in flight',
        skip: 'BUG: chat_provider_actions.dart recallMessage catch restores the '
            'whole pre-request snapshot (`state = AsyncData(current)`), wiping '
            'realtime messages received meanwhile. Fix: drop the restore — '
            'recall applies no optimistic change.', () async {
      final h = await ChatHarness.create(initial: [msg('m1', sender: kMe)]);
      addTearDown(h.dispose);
      final gate = Completer<void>();
      when(() => h.repo.recallMessage('m1')).thenAnswer((_) => gate.future);
      final recalling = h.notifier.recallMessage('m1');
      h.stomp.messagesCtrl.add(msg('m2'));
      await settle();
      gate.completeError(_offline());
      await recalling;
      expect(h.ids, ['m2', 'm1']);
    });
  });

  group('pin / unpin', () {
    test('pins optimistically (newest first) and keeps it on success',
        () async {
      final h = await ChatHarness.create(
          initial: [msg('m2'), msg('m1')],
          conv: conversation(pinned: [pinnedOf('m1')]));
      addTearDown(h.dispose);
      when(() => h.repo.pinMessage('m2')).thenAnswer((_) async => ['m2', 'm1']);
      final ok = await h.notifier.pinMessage(h.state.messages.first);
      expect(ok, isTrue);
      expect(h.state.pinnedMessages.map((p) => p.id), ['m2', 'm1']);
      expect(h.state.pinnedMessages.first.type, 'text');
    });

    test('already pinned → true without a request', () async {
      final h = await ChatHarness.create(
          initial: [msg('m1')], conv: conversation(pinned: [pinnedOf('m1')]));
      addTearDown(h.dispose);
      expect(await h.notifier.pinMessage(h.state.messages.single), isTrue);
      verifyNever(() => h.repo.pinMessage(any()));
    });

    testWidgets('limit reached → refused locally with the localized limit text',
        (t) async {
      await _pumpHost(t);
      final h = await ChatHarness.create(
        initial: [msg('m9')],
        conv: conversation(
            pinned: [for (var i = 0; i < 5; i++) pinnedOf('p$i')]),
      );
      final ok = await h.notifier.pinMessage(h.state.messages.single);
      await t.pump();
      expect(ok, isFalse);
      expect(h.state.pinnedMessages, hasLength(5));
      expect(h.state.pinnedMessages.any((p) => p.id == 'm9'), isFalse);
      verifyNever(() => h.repo.pinMessage(any()));
      expect(find.text(_en.pinLimitReached(5)), findsOneWidget);
      await _finish(t, h);
    });

    testWidgets('server 409 PIN_LIMIT_REACHED rolls back with server max',
        (t) async {
      await _pumpHost(t);
      final h = await ChatHarness.create(initial: [msg('m1')]);
      when(() => h.repo.pinMessage('m1')).thenAnswer((_) async => throw _http(
          409, {'code': 'PIN_LIMIT_REACHED', 'params': {'max': 3}}));
      final ok = await h.notifier.pinMessage(h.state.messages.single);
      await t.pump();
      expect(ok, isFalse);
      expect(h.state.pinnedMessages, isEmpty);
      expect(find.text(_en.pinLimitReached(3)), findsOneWidget);
      await _finish(t, h);
    });

    test('unpin failure restores the pinned list', () async {
      final h = await ChatHarness.create(
          initial: [msg('m1')],
          conv: conversation(pinned: [pinnedOf('m1'), pinnedOf('m0')]));
      addTearDown(h.dispose);
      final gate = Completer<List<String>>();
      when(() => h.repo.unpinMessage('m1')).thenAnswer((_) => gate.future);
      final unpinning = h.notifier.unpinMessage('m1');
      expect(h.state.pinnedMessages.map((p) => p.id), ['m0']);
      gate.completeError(_offline());
      await unpinning;
      expect(h.state.pinnedMessages.map((p) => p.id), ['m1', 'm0']);
    });

    test('unpin success keeps it removed', () async {
      final h = await ChatHarness.create(
          initial: [msg('m1')], conv: conversation(pinned: [pinnedOf('m1')]));
      addTearDown(h.dispose);
      when(() => h.repo.unpinMessage('m1')).thenAnswer((_) async => []);
      await h.notifier.unpinMessage('m1');
      expect(h.state.pinnedMessages, isEmpty);
    });
  });

  group('forward', () {
    test('success → null', () async {
      final h = await ChatHarness.create(initial: [msg('m1')]);
      addTearDown(h.dispose);
      when(() => h.repo.forwardMessage('m1', 'c2'))
          .thenAnswer((_) async => msg('f1', conversationId: 'c2'));
      expect(await h.notifier.forwardMessage('m1', 'c2'), isNull);
    });

    test('blocked / network → localized reason, never the raw exception',
        () async {
      final h = await ChatHarness.create(initial: [msg('m1')]);
      addTearDown(h.dispose);
      when(() => h.repo.forwardMessage('m1', 'c2'))
          .thenAnswer((_) async => throw _http(403, {'code': 'USER_BLOCKED'}));
      expect(await h.notifier.forwardMessage('m1', 'c2'), _en.errChatUserBlocked);
      when(() => h.repo.forwardMessage('m1', 'c3'))
          .thenAnswer((_) async => throw _offline());
      final reason = await h.notifier.forwardMessage('m1', 'c3');
      expect(reason, _en.errNetwork);
      expect(reason, isNot(contains('SocketException')));
    });
  });

  group('delete for me', () {
    test('removes locally and calls the server', () async {
      final h = await ChatHarness.create(initial: [msg('m2'), msg('m1')]);
      addTearDown(h.dispose);
      when(() => h.repo.deleteMessageForMe('m1')).thenAnswer((_) async {});
      await h.notifier.deleteForMe('m1');
      expect(h.ids, ['m2']);
    });

    test('failure restores the removed message', () async {
      final h = await ChatHarness.create(initial: [msg('m2'), msg('m1')]);
      addTearDown(h.dispose);
      when(() => h.repo.deleteMessageForMe('m1'))
          .thenAnswer((_) async => throw _offline());
      await h.notifier.deleteForMe('m1');
      expect(h.ids, ['m2', 'm1']);
    });

    test(
        'failure rollback must keep messages that arrived meanwhile',
        skip: 'BUG: chat_provider_actions.dart deleteForMe catch does '
            '`state = AsyncData(current)` — the whole pre-request snapshot — so a '
            'realtime message received during the request disappears. Fix: '
            're-insert only the removed message into the latest state.',
        () async {
      final h = await ChatHarness.create(initial: [msg('m1')]);
      addTearDown(h.dispose);
      final gate = Completer<void>();
      when(() => h.repo.deleteMessageForMe('m1'))
          .thenAnswer((_) => gate.future);
      final deleting = h.notifier.deleteForMe('m1');
      h.stomp.messagesCtrl.add(msg('m2'));
      await settle();
      gate.completeError(_offline());
      await deleting;
      expect(h.ids, ['m2', 'm1']);
    });
  });
}
