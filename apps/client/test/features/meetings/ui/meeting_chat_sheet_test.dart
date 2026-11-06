import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
import 'package:platform_client/features/meetings/domain/room_phase.dart';
import 'package:platform_client/features/meetings/ui/room/meeting_chat_sheet.dart';

import 'meeting_test_harness.dart';
import 'room_test_harness.dart';

void main() {
  var clock = DateTime.utc(2026, 10, 8, 9);

  Future<RoomHarness> pumpChat(WidgetTester tester) {
    clock = DateTime.utc(2026, 10, 8, 9);
    return pumpRoom(tester,
        now: () => clock, child: const Scaffold(body: MeetingChatSheet()));
  }

  Future<void> send(WidgetTester tester, String text) async {
    await tester.enterText(find.byType(TextField), text);
    await tester.pump();
    await tester.tap(find.byTooltip(l10nOf(tester).meetingChatSend));
    await tester.pump();
  }

  testWidgets('sending publishes, clears the box and shows the line as sending',
      (tester) async {
    final h = await pumpChat(tester);
    await send(tester, 'hello');
    final l = l10nOf(tester);
    expect(h.rt.sent.last.$1, '/app/meet.chat');
    expect(h.rt.sent.last.$2['content'], 'hello');
    expect(tester.widget<TextField>(find.byType(TextField)).controller?.text,
        isEmpty);
    expect(find.text('hello'), findsOneWidget);
    expect(find.text(l.meetingChatSending), findsOneWidget);
  });

  testWidgets('a rate-limited line can be retried with the same clientId',
      (tester) async {
    final h = await pumpChat(tester);
    await send(tester, 'hello');
    h.controller.handle(const MeetErrorEvent(
        meetingId: 'm1', clientId: 'c-abc', errorCode: 'RATE_LIMITED'));
    await tester.pump();
    final l = l10nOf(tester);
    expect(find.textContaining(l.meetingErrRateLimited), findsOneWidget);
    await tester.tap(find.text(l.meetingChatRetry));
    await tester.pump();
    expect(h.rt.sent, hasLength(2));
    expect(h.rt.sent.last.$2['clientId'], 'c-abc');
  });

  testWidgets('a line without an echo for 10 s shows a network error',
      (tester) async {
    await pumpChat(tester);
    await send(tester, 'hello');
    clock = clock.add(const Duration(seconds: 12));
    await tester.pump(const Duration(seconds: 12));
    final l = l10nOf(tester);
    expect(find.textContaining(l.meetingErrNetwork), findsOneWidget);
    expect(find.text(l.meetingChatDiscard), findsOneWidget);
    await tester.tap(find.text(l.meetingChatDiscard));
    await tester.pump();
    expect(find.text('hello'), findsNothing);
  });

  testWidgets('chat text is shown as plain text, never markup', (tester) async {
    final h = await pumpChat(tester);
    h.controller.onTopicEvent(ChatEvent(
        meetingId: 'm1',
        message: MeetingChatMessage(
            id: 'x1',
            sender: const MeetingPerson(userId: 'bob', displayName: 'Bob'),
            content: '<b>x</b>',
            createdAt: clock)));
    await tester.pump();
    expect(find.text('<b>x</b>'), findsOneWidget);
    expect(find.textContaining('Bob', findRichText: true), findsOneWidget);
  });

  testWidgets('offline: the composer is locked and says why', (tester) async {
    final h = await pumpChat(tester);
    h.setRealtime(false);
    await tester.pump();
    await tester.pump();
    final l = l10nOf(tester);
    expect(find.text(l.meetingChatOffline), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField)).enabled, isFalse);
  });

  testWidgets('too long a message cannot be sent', (tester) async {
    final h = await pumpChat(tester);
    await tester.enterText(find.byType(TextField), 'a' * 2001);
    await tester.pump();
    final l = l10nOf(tester);
    expect(find.text(l.meetingErrChatTooLong(2000)), findsOneWidget);
    await tester.tap(find.byTooltip(l.meetingChatSend));
    await tester.pump();
    expect(h.rt.sent, isEmpty);
  });

  testWidgets('an empty chat says who can see messages', (tester) async {
    await pumpChat(tester);
    expect(find.text(l10nOf(tester).meetingChatEmpty), findsOneWidget);
  });

  testWidgets('before the first history read it shows a spinner, not "empty"',
      (tester) async {
    await pumpRoom(tester,
        phase: RoomPhase.prejoin,
        settle: false,
        child: const Scaffold(body: MeetingChatSheet()));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text(l10nOf(tester).meetingChatEmpty), findsNothing);
  });

  group('AI answers', () {
    const bot = 'ai-bot-000000000000000000000001';
    ChatEvent line(String sender, String text, {String name = 'Someone'}) =>
        ChatEvent(
            meetingId: 'm1',
            message: MeetingChatMessage(
                id: 'x-$sender-${text.hashCode}',
                sender: MeetingPerson(userId: sender, displayName: name),
                content: text,
                createdAt: clock));

    testWidgets('the AI line is Markdown under a localized name; others stay plain',
        (tester) async {
      final h = await pumpChat(tester);
      h.controller.onTopicEvent(line(bot, 'a **bold** word', name: 'raw-bot-name'));
      h.controller.onTopicEvent(line('bob', 'a **plain** word', name: 'Bob'));
      await tester.pump();
      expect(find.textContaining(l10nOf(tester).meetingAiName, findRichText: true),
          findsOneWidget);
      expect(find.text('raw-bot-name'), findsNothing);
      expect(find.byType(MarkdownBody), findsOneWidget);
      expect(find.text('a **plain** word'), findsOneWidget);
    });

    testWidgets('images in an AI line are never loaded', (tester) async {
      final h = await pumpChat(tester);
      h.controller.onTopicEvent(
          line(bot, 'see ![pic](https://evil.example/x.png) here'));
      await tester.pump();
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('"answering" shows for everyone until the AI line arrives',
        (tester) async {
      final h = await pumpChat(tester);
      final l = l10nOf(tester);
      h.controller.onTopicEvent(const AiEvent(
          meetingId: 'm1', state: AiState.thinking, requesterId: 'bob'));
      await tester.pump();
      expect(find.text(l.meetingAiThinking), findsOneWidget);
      h.controller.onTopicEvent(line(bot, 'done'));
      await tester.pump();
      expect(find.text(l.meetingAiThinking), findsNothing);
      await tester.pump(const Duration(seconds: 61)); // the expiry timer
    });

    testWidgets('an error is a translated line for the requester only, never the code',
        (tester) async {
      final h = await pumpChat(tester);
      final l = l10nOf(tester);
      h.controller.onTopicEvent(const AiEvent(
          meetingId: 'm1', state: AiState.error, requesterId: 'bob', code: 'AI_UNAVAILABLE'));
      await tester.pump();
      expect(find.text(l.meetingAiUnavailable), findsNothing);
      h.controller.onTopicEvent(const AiEvent(
          meetingId: 'm1', state: AiState.error, requesterId: 'me', code: 'AI_UNAVAILABLE'));
      h.controller.onTopicEvent(const AiEvent(
          meetingId: 'm1', state: AiState.error, requesterId: 'me', code: 'AI_EMPTY'));
      await tester.pump();
      expect(find.text(l.meetingAiUnavailable), findsOneWidget);
      expect(find.text(l.meetingAiFailed), findsOneWidget);
      expect(find.textContaining('AI_'), findsNothing);
    });

    testWidgets('the empty chat hints at @AI', (tester) async {
      await pumpChat(tester);
      expect(find.text(l10nOf(tester).meetingChatAiHint), findsOneWidget);
    });
  });
}
