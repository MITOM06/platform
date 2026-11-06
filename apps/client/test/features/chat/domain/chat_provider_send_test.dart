// ChatNotifier send path (chat_provider_send.dart): optimistic bubble →
// STOMP echo / REST confirmation, watchdog → tap-to-retry, no duplicates when
// the echo and the REST response race, AI placeholder, MESSAGE_REJECTED, and
// localized (never raw) error text.

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:platform_client/core/utils/global_messenger.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import 'package:platform_client/l10n/app_localizations_en.dart';

import 'chat_notifier_harness.dart';

final _en = AppLocalizationsEn();

DioException _networkError() => DioException(
      requestOptions: RequestOptions(path: '/api/messages'),
      type: DioExceptionType.connectionError,
      message: 'SocketException: Connection refused (raw)',
    );

/// Mounts a MaterialApp on [rootNavigatorKey] so error banners render and
/// `appL10n()` resolves real localized strings.
Future<void> _pumpHost(WidgetTester tester) async {
  await tester.pumpWidget(MaterialApp(
    navigatorKey: rootNavigatorKey,
    locale: const Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: const Scaffold(body: SizedBox()),
  ));
}

/// Lets the banner auto-dismiss so no timers are left pending.
Future<void> _drainBanner(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 4));
  await tester.pump(const Duration(seconds: 1));
}

ChatHarness _createSync(FakeAsync fa,
    {List<MessageModel> initial = const [],
    bool connected = true,
    ConversationModel? conv,
    String? userId = kMe}) {
  ChatHarness? h;
  ChatHarness.create(
          initial: initial, connected: connected, conv: conv, userId: userId)
      .then((v) => h = v);
  fa.flushMicrotasks();
  return h!;
}

void main() {
  setUpAll(() => registerFallbackValue(DateTime(2024)));

  group('STOMP path', () {
    test('optimistic bubble first, sent with reply target, reply composer cleared',
        () {
      fakeAsync((fa) {
        final h = _createSync(fa, initial: [msg('m1')]);
        h.notifier.startReply(h.state.messages.single);
        h.notifier.sendMessage('hello');
        fa.flushMicrotasks();

        final first = h.state.messages.first;
        expect(first.id, startsWith('pending_'));
        expect(first.isPending, isTrue);
        expect(first.content, 'hello');
        expect(first.replyToId, 'm1');
        expect(h.state.replyingTo, isNull);
        expect(h.stomp.sentMessages.single,
            {'conversationId': kConv, 'content': 'hello', 'type': 'text', 'replyToId': 'm1'});
        verifyNever(() => h.repo.sendMessageRest(any(), any(),
            type: any(named: 'type'), replyToId: any(named: 'replyToId')));
        h.dispose();
      });
    });

    test('server echo replaces the optimistic bubble (no duplicate) and the '
        'watchdog never fails it', () {
      fakeAsync((fa) {
        final h = _createSync(fa, initial: [msg('m1')]);
        h.notifier.sendMessage('hello');
        fa.flushMicrotasks();
        h.stomp.messagesCtrl.add(msg('srv-1', sender: kMe, content: 'hello'));
        fa.flushMicrotasks();
        expect(h.ids, ['srv-1', 'm1']);

        fa.elapse(const Duration(seconds: 20));
        expect(h.state.messages.any((m) => m.sendFailed), isFalse);
        expect(h.ids, ['srv-1', 'm1']);
        h.dispose();
      });
    });

    test('no echo within 15 s → bubble marked failed (tap-to-retry)', () {
      fakeAsync((fa) {
        final h = _createSync(fa);
        h.notifier.sendMessage('lost');
        fa.flushMicrotasks();
        fa.elapse(const Duration(seconds: 14));
        expect(h.state.messages.single.isPending, isTrue);
        fa.elapse(const Duration(seconds: 2));
        final m = h.state.messages.single;
        expect(m.isPending, isFalse);
        expect(m.sendFailed, isTrue);
        expect(m.content, 'lost');
        h.dispose();
      });
    });

    test('late echo after the watchdog fired still reconciles the failed bubble',
        () {
      fakeAsync((fa) {
        final h = _createSync(fa);
        h.notifier.sendMessage('slow');
        fa.flushMicrotasks();
        fa.elapse(const Duration(seconds: 16));
        h.stomp.messagesCtrl.add(msg('srv-1', sender: kMe, content: 'slow'));
        fa.flushMicrotasks();
        expect(h.ids, ['srv-1']);
        expect(h.state.messages.single.sendFailed, isFalse);
        h.dispose();
      });
    });

    test('logged out → send is a no-op', () {
      fakeAsync((fa) {
        final h = _createSync(fa, userId: null);
        h.notifier.sendMessage('x');
        fa.flushMicrotasks();
        expect(h.state.messages, isEmpty);
        expect(h.stomp.sentMessages, isEmpty);
        h.dispose();
      });
    });
  });

  group('REST fallback (socket down)', () {
    test('success swaps the optimistic bubble for the server message', () async {
      final h = await ChatHarness.create(connected: false);
      addTearDown(h.dispose);
      when(() => h.repo.sendMessageRest(kConv, 'hi', type: 'text', replyToId: null))
          .thenAnswer((_) async => msg('srv-1', sender: kMe, content: 'hi'));
      await h.notifier.sendMessage('hi');
      expect(h.ids, ['srv-1']);
      expect(h.state.messages.single.isPending, isFalse);

      // The STOMP echo of the same message later must not duplicate it.
      h.stomp.messagesCtrl.add(msg('srv-1', sender: kMe, content: 'hi'));
      await settle();
      expect(h.ids, ['srv-1']);
    });

    test('echo arriving BEFORE the REST response → still exactly one copy',
        () async {
      final h = await ChatHarness.create(connected: false);
      addTearDown(h.dispose);
      final completer = Completer<MessageModel>();
      when(() => h.repo.sendMessageRest(kConv, 'race', type: 'text', replyToId: null))
          .thenAnswer((_) => completer.future);
      final sending = h.notifier.sendMessage('race');
      await settle();
      h.stomp.messagesCtrl.add(msg('srv-9', sender: kMe, content: 'race'));
      await settle();
      completer.complete(msg('srv-9', sender: kMe, content: 'race'));
      await sending;
      expect(h.ids, ['srv-9']);
    });

    test('echo that did not match the optimistic bubble (server-normalized '
        'text) + REST response → still exactly one copy', () async {
      final h = await ChatHarness.create(connected: false);
      addTearDown(h.dispose);
      final completer = Completer<MessageModel>();
      when(() => h.repo.sendMessageRest(kConv, ' trimmed ',
          type: 'text', replyToId: null)).thenAnswer((_) => completer.future);
      final sending = h.notifier.sendMessage(' trimmed ');
      await settle();
      h.stomp.messagesCtrl.add(msg('srv-7', sender: kMe, content: 'trimmed'));
      await settle();
      completer.complete(msg('srv-7', sender: kMe, content: 'trimmed'));
      await sending;
      expect(h.ids, ['srv-7']);
    });

    testWidgets('network failure → failed bubble + localized banner, never raw',
        (tester) async {
      await _pumpHost(tester);
      final h = await ChatHarness.create(connected: false);
      when(() => h.repo.sendMessageRest(kConv, 'hi', type: 'text', replyToId: null))
          .thenAnswer((_) async => throw _networkError());
      await h.notifier.sendMessage('hi');
      await tester.pump();

      final m = h.state.messages.single;
      expect(m.sendFailed, isTrue);
      expect(m.isPending, isFalse);
      expect(find.text(_en.errNetwork), findsOneWidget);
      expect(find.textContaining('SocketException'), findsNothing);
      await _drainBanner(tester);
      h.dispose();
      await tester.pump(const Duration(seconds: 1));
    });

    test('retrySend drops the failed bubble and re-sends to the same reply target',
        () async {
      final h = await ChatHarness.create(initial: [msg('m1')], connected: false);
      addTearDown(h.dispose);
      when(() => h.repo.sendMessageRest(kConv, 'hi',
              type: 'text', replyToId: 'm1'))
          .thenAnswer((_) async => throw _networkError());
      h.notifier.startReply(h.state.messages.single);
      await h.notifier.sendMessage('hi');
      final failed = h.state.messages.first;
      expect(failed.sendFailed, isTrue);

      when(() => h.repo.sendMessageRest(kConv, 'hi',
              type: 'text', replyToId: 'm1'))
          .thenAnswer((_) async => msg('srv-2', sender: kMe, content: 'hi'));
      await h.notifier.retrySend(failed.id);
      expect(h.ids, ['srv-2', 'm1']);
      verify(() => h.repo.sendMessageRest(kConv, 'hi',
          type: 'text', replyToId: 'm1')).called(2);
    });

    test('retrySend ignores unknown ids and messages that did not fail',
        () async {
      final h = await ChatHarness.create(initial: [msg('m1')]);
      addTearDown(h.dispose);
      await h.notifier.retrySend('nope');
      await h.notifier.retrySend('m1');
      expect(h.ids, ['m1']);
      expect(h.stomp.sentMessages, isEmpty);
    });
  });

  group('AI placeholder', () {
    test('@AI mention adds a thinking placeholder above the message', () {
      fakeAsync((fa) {
        final h = _createSync(fa);
        h.notifier.sendMessage('hey @ai what is up');
        fa.flushMicrotasks();
        final ai = h.state.messages.first;
        expect(ai.senderId, kAiBotUserId);
        expect(ai.isThinking, isTrue);
        expect(h.state.messages[1].id, startsWith('pending_'));
        h.dispose();
      });
    });

    test('no mention in a normal chat → no placeholder', () {
      fakeAsync((fa) {
        final h = _createSync(fa);
        h.notifier.sendMessage('email me at bob@aim.com');
        fa.flushMicrotasks();
        expect(h.state.messages.where((m) => m.isAiMessage), isEmpty);
        h.dispose();
      });
    });

    test('1-1 AI chat: every text gets a placeholder, an image does not', () {
      fakeAsync((fa) {
        final h = _createSync(fa,
            conv: conversation(participants: [kMe, kAiBotUserId]));
        h.notifier.sendMessage('/api/uploads/x.png', type: 'image');
        fa.flushMicrotasks();
        expect(h.state.messages.where((m) => m.isAiMessage), isEmpty);
        h.notifier.sendMessage('hello');
        fa.flushMicrotasks();
        expect(h.state.messages.where((m) => m.isAiMessage), hasLength(1));
        h.dispose();
      });
    });

    test('a failed send removes its AI placeholder (no stuck "thinking")', () {
      fakeAsync((fa) {
        final h = _createSync(fa);
        h.notifier.sendMessage('@AI help');
        fa.flushMicrotasks();
        fa.elapse(const Duration(seconds: 16));
        expect(h.state.messages.where((m) => m.isAiMessage), isEmpty);
        expect(h.state.messages.single.sendFailed, isTrue);
        h.dispose();
      });
    });
  });

  group('MESSAGE_REJECTED', () {
    testWidgets('fails the OLDEST pending send at once and shows the code text',
        (tester) async {
      await _pumpHost(tester);
      final h = await ChatHarness.create();
      h.notifier.sendMessage('first');
      await tester.pump(const Duration(milliseconds: 1));
      h.notifier.sendMessage('second');
      await tester.pump();

      h.stomp.notifCtrl.add({
        'type': 'MESSAGE_REJECTED',
        'conversationId': kConv,
        'code': 'USER_BLOCKED',
      });
      await tester.pump();
      await tester.pump();

      final byContent = {for (final m in h.state.messages) m.content: m};
      expect(byContent['first']!.sendFailed, isTrue);
      expect(byContent['second']!.isPending, isTrue);
      expect(find.text(_en.errChatUserBlocked), findsOneWidget);
      expect(find.textContaining('USER_BLOCKED'), findsNothing);
      await _drainBanner(tester);
      h.dispose();
      await tester.pump(const Duration(seconds: 20));
    });

    testWidgets('rejection for another conversation is ignored; null code → '
        'generic localized text', (tester) async {
      await _pumpHost(tester);
      final h = await ChatHarness.create();
      h.notifier.sendMessage('a');
      await tester.pump();
      h.stomp.notifCtrl.add({
        'type': 'MESSAGE_REJECTED',
        'conversationId': 'c-other',
        'code': 'USER_BLOCKED',
      });
      await tester.pump();
      await tester.pump();
      expect(h.state.messages.single.isPending, isTrue);
      expect(find.text(_en.errChatUserBlocked), findsNothing);

      h.stomp.notifCtrl
          .add({'type': 'MESSAGE_REJECTED', 'conversationId': kConv});
      await tester.pump();
      await tester.pump();
      expect(h.state.messages.single.sendFailed, isTrue);
      expect(find.text(_en.errActionFailed), findsOneWidget);
      await _drainBanner(tester);
      h.dispose();
      await tester.pump(const Duration(seconds: 20));
    });
  });
}
