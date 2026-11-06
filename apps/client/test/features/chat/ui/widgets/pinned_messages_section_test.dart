// Widget tests for PinnedMessagesSection (info panel list of pins): sender
// naming (never a raw id), sanitized previews, unpin permission, cap of 5.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_provider.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/ui/widgets/pinned_messages_section.dart';

import 'chat_widget_harness.dart';

const _aiBot = 'ai-bot-000000000000000000000001';

PinnedMessageModel _pin(String id, String content,
        {String senderId = kBob, String type = 'text'}) =>
    PinnedMessageModel(id: id, senderId: senderId, content: content, type: type);

Future<FakeChatNotifier> _pump(
  WidgetTester tester,
  List<PinnedMessageModel> pins, {
  ConversationModel? conv,
  bool showHeader = true,
}) async {
  final chat = FakeChatNotifier(const ChatState(messages: [], hasMore: false));
  final overrides = await baseOverrides(
      names: const {kBob: 'Bob'}, chat: chat);
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...overrides,
      conversationProvider.overrideWith((ref, id) => conv),
    ],
    child: wrapWidget(SingleChildScrollView(
      child: PinnedMessagesSection(
          conversationId: kConv, pinnedMessages: pins, showHeader: showHeader),
    )),
  ));
  await tester.pumpAndSettle();
  return chat;
}

void main() {
  testWidgets('no pins → renders nothing', (tester) async {
    await _pump(tester, const []);
    expect(find.text(en.pinnedMessagesTitle), findsNothing);
    expect(find.byType(ListTile), findsNothing);
  });

  testWidgets('header + sender name + text preview', (tester) async {
    await _pump(tester, [_pin('p1', 'ship it')]);

    expect(find.text(en.pinnedMessagesTitle), findsOneWidget);
    expect(find.text('Bob'), findsOneWidget);
    expect(find.text('ship it'), findsOneWidget);
  });

  testWidgets('showHeader: false hides the header', (tester) async {
    await _pump(tester, [_pin('p1', 'x')], showHeader: false);
    expect(find.text(en.pinnedMessagesTitle), findsNothing);
  });

  testWidgets('AI-sent pin is named by l10n, not its bot id', (tester) async {
    await _pump(tester, [_pin('p1', 'answer', senderId: _aiBot, type: 'ai')]);

    expect(find.text(en.aiAssistant), findsOneWidget);
    expectNoRaw(tester, [_aiBot]);
  });

  testWidgets('unresolvable sender → placeholder, never the raw id',
      (tester) async {
    await _pump(tester, [_pin('p1', 'hi', senderId: kCarol)]);
    expectNoRaw(tester, [kCarol]);
  });

  testWidgets('system / file / image pins are sanitized', (tester) async {
    await _pump(tester, [
      _pin('p1', 'system.nickname.changed:$kCarol:Caz', type: 'system'),
      _pin('p2', kFileJson, type: 'file'),
      _pin('p3', kUploadUrl, type: 'image'),
    ]);

    expect(find.text(en.pinnedSystemMessage), findsOneWidget);
    expect(find.text('[${en.attachFile}]'), findsOneWidget);
    expect(find.text('[${en.attachPhoto}]'), findsOneWidget);
    expectNoRaw(tester, ['system.', kCarol, '/api/uploads/', '{"url"']);
  });

  testWidgets(
    'typeless pin with a system code is humanized',
    (tester) async {
      await _pump(tester, [_pin('p1', 'system.message.pinned:$kCarol')]);
      expectNoRaw(tester, ['system.', kCarol]);
    },
  );

  testWidgets('shows at most 5 pins', (tester) async {
    await _pump(tester, [for (var i = 0; i < 7; i++) _pin('p$i', 'pin $i')]);

    expect(find.byType(ListTile), findsNWidgets(5));
    expect(find.text('pin 5'), findsNothing);
  });

  testWidgets('DM member can unpin; tapping calls unpinMessage',
      (tester) async {
    final chat = await _pump(tester, [_pin('p1', 'x')],
        conv: ConversationModel(
            id: kConv,
            participants: const [kMe, kBob],
            unreadCount: 0,
            createdAt: DateTime(2026)));

    await tester.tap(find.byTooltip(en.unpinMessage));
    expect(chat.calls, ['unpin:p1']);
  });

  testWidgets('group non-admin gets no unpin button', (tester) async {
    await _pump(tester, [_pin('p1', 'x')],
        conv: ConversationModel(
            id: kConv,
            type: 'group',
            participants: const [kMe, kBob],
            admins: const [kBob],
            unreadCount: 0,
            createdAt: DateTime(2026)));

    expect(find.byTooltip(en.unpinMessage), findsNothing);
  });

  testWidgets('group admin can unpin', (tester) async {
    await _pump(tester, [_pin('p1', 'x')],
        conv: ConversationModel(
            id: kConv,
            type: 'group',
            participants: const [kMe, kBob],
            admins: const [kMe],
            unreadCount: 0,
            createdAt: DateTime(2026)));

    expect(find.byTooltip(en.unpinMessage), findsOneWidget);
  });
}
