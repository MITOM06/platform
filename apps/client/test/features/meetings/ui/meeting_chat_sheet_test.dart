import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/meeting_events.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/domain/meeting_room_models.dart';
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
}
