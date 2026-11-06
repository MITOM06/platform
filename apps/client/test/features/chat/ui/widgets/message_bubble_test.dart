// Widget tests for MessageBubble (+ its body/parts): every message kind the
// bubble renders, and `.claude/rules/no-raw-system-data-in-ui.md` — a system
// code, user id, upload URL, JSON payload or AI sentinel must never be shown.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/domain/message_selection_provider.dart';
import 'package:platform_client/features/chat/ui/widgets/message_bubble.dart';

import 'chat_widget_harness.dart';

const _empty = ChatState(messages: [], hasMore: false);

Future<FakeChatNotifier> _pump(
  WidgetTester tester,
  MessageModel message, {
  bool isSentByMe = false,
  bool showSenderName = false,
  bool isGroup = false,
  String? otherUserId,
  Map<String, String> names = const {},
  ChatState state = _empty,
  bool settle = true,
  Map<String, Object> prefs = const {},
}) async {
  final chat = FakeChatNotifier(state);
  final overrides =
      await baseOverrides(names: names, chat: chat, prefs: prefs);
  await tester.pumpWidget(wrapWidget(
    MessageBubble(
      message: message,
      isSentByMe: isSentByMe,
      showSenderName: showSenderName,
      isGroup: isGroup,
      otherUserId: otherUserId,
    ),
    overrides: overrides,
  ));
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump(const Duration(milliseconds: 400));
  }
  return chat;
}

void main() {
  group('MessageBubble — text', () {
    testWidgets('renders text, time and the single delivered tick in a DM',
        (tester) async {
      await _pump(tester, msg(senderId: kMe, content: 'see you at 5'),
          isSentByMe: true, otherUserId: kBob);

      expect(find.text('see you at 5'), findsOneWidget);
      expect(find.text('09:30'), findsOneWidget);
      expect(find.byIcon(Icons.done_rounded), findsOneWidget);
      expect(find.byIcon(Icons.done_all_rounded), findsNothing);
    });

    testWidgets('double tick once the other participant has read it',
        (tester) async {
      await _pump(
          tester, msg(senderId: kMe, content: 'hi', readBy: const [kBob]),
          isSentByMe: true, otherUserId: kBob);

      expect(find.byIcon(Icons.done_all_rounded), findsOneWidget);
    });

    testWidgets('groups never show a per-user read tick', (tester) async {
      await _pump(tester, msg(senderId: kMe, content: 'hi'),
          isSentByMe: true, isGroup: true);

      expect(find.byIcon(Icons.done_rounded), findsNothing);
      expect(find.byIcon(Icons.done_all_rounded), findsNothing);
    });

    testWidgets('edited marker is localized', (tester) async {
      await _pump(tester,
          msg(content: 'fixed typo', editedAt: DateTime(2026, 1, 2, 9, 31)));

      expect(find.text(en.messageEdited), findsOneWidget);
    });

    testWidgets('reaction chips aggregate identical emojis', (tester) async {
      await _pump(
        tester,
        msg(content: 'nice', reactions: const [
          ReactionModel(userId: kBob, emoji: '❤️'),
          ReactionModel(userId: kCarol, emoji: '❤️'),
          ReactionModel(userId: kMe, emoji: '😂'),
        ]),
      );

      expect(find.text('❤️ 2'), findsOneWidget);
      expect(find.text('😂'), findsOneWidget);
    });

    testWidgets('double tap toggles a heart reaction', (tester) async {
      final chat = await _pump(tester, msg(id: 'srv1', content: 'tap me'));

      await tester.tap(find.text('tap me'));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.text('tap me'));
      await tester.pumpAndSettle();

      expect(chat.calls, ['react:srv1:❤️']);
    });

    testWidgets('a local-only (pending) bubble ignores double tap',
        (tester) async {
      final chat = await _pump(
          tester, msg(id: 'pending_1', senderId: kMe, content: 'sending'),
          isSentByMe: true);

      await tester.tap(find.text('sending'));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.text('sending'));
      await tester.pumpAndSettle();

      expect(chat.calls, isEmpty);
    });

    testWidgets('failed send shows the localized retry and retries on tap',
        (tester) async {
      final chat = await _pump(
          tester,
          msg(
              id: 'pending_9',
              senderId: kMe,
              content: 'lost',
              sendFailed: true),
          isSentByMe: true);

      expect(find.text(en.messageSendFailedRetry), findsOneWidget);
      await tester.tap(find.text(en.messageSendFailedRetry));
      expect(chat.calls, ['retry:pending_9']);
    });
  });

  group('MessageBubble — recalled', () {
    testWidgets('shows the recalled label, not the old text/reply/reactions',
        (tester) async {
      await _pump(
        tester,
        msg(
          content: 'secret salary 9000',
          recalled: true,
          replyPreview: const ReplyPreview(senderId: kMe, content: 'quoted'),
          reactions: const [ReactionModel(userId: kMe, emoji: '👍')],
        ),
      );

      expect(find.text(en.messageRecalled), findsOneWidget);
      expect(find.textContaining('secret salary'), findsNothing);
      expect(find.text('quoted'), findsNothing);
      expect(find.text('👍'), findsNothing);
    });
  });

  group('MessageBubble — media / file never show internal URLs or JSON', () {
    testWidgets('image message renders no /api/uploads URL text',
        (tester) async {
      await _pump(tester, msg(content: kUploadUrl, type: 'image'),
          settle: false);

      expectNoRaw(tester, ['/api/uploads/', kUploadUrl]);
    });

    testWidgets('file message renders name + humanized size, not the JSON',
        (tester) async {
      await _pump(tester, msg(content: kFileJson, type: 'file'));

      expect(find.text('salary.pdf'), findsOneWidget);
      // size arrives as a STRING from the backend → must still format.
      expect(find.text('2.0 KB'), findsOneWidget);
      expect(find.byIcon(Icons.picture_as_pdf_rounded), findsOneWidget);
      expectNoRaw(tester, ['/api/uploads/', '{"url"', '"name"']);
    });

    testWidgets('file message with a malformed payload still hides the URL',
        (tester) async {
      await _pump(tester, msg(content: '/api/uploads/6e8f00aa', type: 'file'));

      expectNoRaw(tester, ['/api/uploads/']);
    });
  });

  group('MessageBubble — system messages', () {
    testWidgets('nickname change names both people, never their ids',
        (tester) async {
      await _pump(
        tester,
        msg(
            senderId: kBob,
            type: 'system',
            content: 'system.nickname.changed:$kCarol:Caz'),
        names: const {kBob: 'Bob', kCarol: 'Carol'},
      );

      expect(find.text(en.sysNicknameSetOther('Bob', 'Carol', 'Caz')),
          findsOneWidget);
      expectNoRaw(tester, ['system.', kBob, kCarol]);
    });

    testWidgets('unresolvable user falls back to "Someone", never the id',
        (tester) async {
      await _pump(
        tester,
        msg(
            senderId: 'system',
            type: 'system',
            content: 'system.message.pinned:$kCarol'),
      );

      expect(find.text(en.sysPinnedMessage(en.someone)), findsOneWidget);
      expectNoRaw(tester, ['system.', kCarol]);
    });

    testWidgets('the current user is named "You"', (tester) async {
      await _pump(
        tester,
        msg(
            senderId: 'system',
            type: 'system',
            content: 'system.message.pinned:$kMe'),
      );

      expect(find.text(en.sysPinnedMessage(en.you)), findsOneWidget);
    });

    testWidgets('an unknown system code renders nothing (no raw key)',
        (tester) async {
      await _pump(tester,
          msg(type: 'system', content: 'system.future.event:$kBob:x'));

      expect(allText(tester).trim(), isEmpty);
    });
  });

  group('MessageBubble — reply quote (sanitized)', () {
    Future<void> pumpReply(WidgetTester tester, ReplyPreview p) =>
        _pump(tester, msg(content: 'my answer', replyPreview: p));

    testWidgets('quotes plain text verbatim', (tester) async {
      await pumpReply(
          tester, const ReplyPreview(senderId: kBob, content: 'the question'));

      expect(find.text('the question'), findsOneWidget);
      expect(find.text('my answer'), findsOneWidget);
    });

    testWidgets('quoted file JSON → localized [File] label', (tester) async {
      await pumpReply(
          tester, const ReplyPreview(senderId: kBob, content: kFileJson));

      expect(find.text('[${en.attachFile}]'), findsOneWidget);
      expectNoRaw(tester, ['{"url"', '/api/uploads/', 'salary.pdf']);
    });

    testWidgets('quoted nickname code → generic sentence, no user id',
        (tester) async {
      await pumpReply(
        tester,
        const ReplyPreview(
            senderId: kBob, content: 'system.nickname.changed:$kCarol:Caz'),
      );

      expect(find.text(en.systemNicknameChanged), findsOneWidget);
      expectNoRaw(tester, ['system.', kCarol]);
    });

    testWidgets('quoted unknown system code → generic label', (tester) async {
      await pumpReply(tester,
          const ReplyPreview(senderId: kBob, content: 'system.weird:$kCarol'));

      expect(find.text(en.pinnedSystemMessage), findsOneWidget);
      expectNoRaw(tester, ['system.', kCarol]);
    });

    testWidgets('quoted meeting summary JSON → localized label',
        (tester) async {
      await pumpReply(
        tester,
        const ReplyPreview(
            senderId: kBob,
            content: '{"overview":"Q3 plan","keyPoints":["a"]}'),
      );

      expect(find.text('[${en.meetingSummaryTitle}]'), findsOneWidget);
      expectNoRaw(tester, ['"overview"', 'Q3 plan']);
    });

    testWidgets('quoted recalled message → recalled label, not old text',
        (tester) async {
      await pumpReply(
        tester,
        const ReplyPreview(senderId: kBob, content: 'old', recalled: true),
      );

      expect(find.text(en.messageRecalled), findsOneWidget);
      expect(find.text('old'), findsNothing);
    });

    testWidgets('quoted voice note URL → [Voice] label', (tester) async {
      await pumpReply(
        tester,
        const ReplyPreview(
            senderId: kBob, content: '/api/uploads/6e8f00aabbccdd.m4a'),
      );

      expect(find.text('[${en.attachVoice}]'), findsOneWidget);
      expectNoRaw(tester, ['/api/uploads/']);
    });
  });

  group('MessageBubble — AI states', () {
    const aiBot = 'ai-bot-000000000000000000000001';

    MessageModel ai(String content, {bool streaming = false, bool thinking = false,
            String id = 'ai-srv-1', List<String> tools = const []}) =>
        msg(
            id: id,
            senderId: aiBot,
            type: 'ai',
            content: content,
            isStreaming: streaming,
            isThinking: thinking,
            activeTools: tools);

    testWidgets('header shows the persona name from the chat state',
        (tester) async {
      await _pump(tester, ai('Hello **there**'),
          state: const ChatState(
              messages: [], hasMore: false, aiPersonaName: 'Jarvis'));

      expect(find.text('Jarvis'), findsOneWidget);
      // Finalized markdown: bold is rendered, the ** markers are not.
      expectNoRaw(tester, ['**']);
    });

    testWidgets('streaming text shows the partial answer + cursor',
        (tester) async {
      await _pump(tester, ai('Partial ans', streaming: true, id: 'ai-1'),
          settle: false);

      expect(find.text('Partial ans'), findsOneWidget);
      expect(find.text('|'), findsOneWidget);
    });

    testWidgets('known tool in use is labelled, never its raw name',
        (tester) async {
      await _pump(
          tester,
          ai('', streaming: true, id: 'ai-1', tools: const ['search_messages']),
          settle: false);

      expect(find.text(en.toolSearchMessages), findsOneWidget);
      expectNoRaw(tester, ['search_messages']);
    });

    final failures = <String, String Function()>{
      '__AI_ERROR__': () => en.aiError,
      '__AI_INTERRUPTED__': () => en.aiErrStreamInterrupted,
      '__AI_UNAVAILABLE__': () => en.aiErrUnavailable,
      '__AI_FORBIDDEN__': () => en.aiErrForbidden,
      '__AI_RATE_LIMITED__': () => en.aiErrRateLimited,
      '__AI_EMPTY__': () => en.aiErrEmptyResponse,
      '__AI_QUOTA__': () => en.aiQuotaExceeded,
    };
    failures.forEach((sentinel, expected) {
      testWidgets('$sentinel → localized notice, sentinel hidden, no feedback',
          (tester) async {
        await _pump(tester, ai(sentinel));

        expect(find.text(expected()), findsOneWidget);
        expectNoRaw(tester, [sentinel, '__AI']);
        expect(find.byTooltip(en.feedbackHelpful), findsNothing);
      });
    });

    testWidgets('finalized server answer offers 👍/👎 feedback',
        (tester) async {
      await _pump(tester, ai('Done.', id: '6e8f0000000000000000abcd'));

      expect(find.byTooltip(en.feedbackHelpful), findsOneWidget);
      expect(find.byTooltip(en.feedbackNotHelpful), findsOneWidget);
    });

    testWidgets('local AI placeholder (ai- id) offers no feedback',
        (tester) async {
      await _pump(tester, ai('Done.', id: 'ai-local-1'));

      expect(find.byTooltip(en.feedbackHelpful), findsNothing);
    });
  });

  group('MessageBubble — group sender header', () {
    testWidgets('shows the resolved sender name', (tester) async {
      await _pump(tester, msg(content: 'yo'),
          showSenderName: true, isGroup: true, names: const {kBob: 'Bob'});

      expect(find.text('Bob'), findsOneWidget);
    });

    testWidgets('unresolved sender shows a placeholder, never the raw id',
        (tester) async {
      await _pump(tester, msg(content: 'yo'),
          showSenderName: true, isGroup: true);

      expectNoRaw(tester, [kBob]);
    });

    testWidgets('nickname wins over the display name', (tester) async {
      await _pump(tester, msg(content: 'yo'),
          showSenderName: true,
          isGroup: true,
          names: const {kBob: 'Bob'},
          prefs: const {
            'chat_nicknames_$kConv': ['$kBob:Bobby']
          });

      expect(find.text('Bobby'), findsOneWidget);
      expect(find.text('Bob'), findsNothing);
    });
  });

  group('MessageBubble — multi-select', () {
    testWidgets('tap selects in select mode and shows the check badge',
        (tester) async {
      final chat = FakeChatNotifier(_empty);
      final overrides = await baseOverrides(chat: chat);
      final container = ProviderContainer(overrides: overrides);
      addTearDown(container.dispose);
      container.read(messageSelectionProvider(kConv).notifier).enter();

      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: wrapWidget(
            MessageBubble(message: msg(id: 'x1', content: 'pick me'),
                isSentByMe: false)),
      ));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.check_rounded), findsNothing);
      await tester.tap(find.text('pick me'));
      await tester.pumpAndSettle();

      expect(container.read(messageSelectionProvider(kConv)).selectedIds,
          {'x1'});
      expect(find.byIcon(Icons.check_rounded), findsOneWidget);
      // Select mode must not fire the heart reaction.
      expect(chat.calls, isEmpty);
    });

    testWidgets('mixing types is rejected with a localized warning',
        (tester) async {
      final overrides = await baseOverrides(chat: FakeChatNotifier(_empty));
      final container = ProviderContainer(overrides: overrides);
      addTearDown(container.dispose);
      final sel = container.read(messageSelectionProvider(kConv).notifier);
      sel.enter();
      sel.toggle('img1', 'image');

      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: wrapWidget(MessageBubble(
            message: msg(id: 't1', content: 'text msg'), isSentByMe: false)),
      ));
      await tester.pumpAndSettle();
      await tester.tap(find.text('text msg'));
      await tester.pump();

      expect(find.text(en.multiSelectTypeWarning(en.msgTypeImage)),
          findsOneWidget);
      expect(container.read(messageSelectionProvider(kConv)).selectedIds,
          {'img1'});
    });
  });
}
