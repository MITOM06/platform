// Widget tests for ChatScreenAppBar: title / subtitle resolution for DM,
// group and AI conversations, presence text, and that a raw user id never
// becomes the title (`docs/engineering/no-raw-system-data-in-ui.md`).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_provider.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/ui/widgets/chat_app_bar.dart';

import 'chat_widget_harness.dart';

const _aiBot = 'ai-bot-000000000000000000000001';

ConversationModel _conv({
  String type = 'direct',
  String? name,
  List<String> participants = const [kMe, kBob],
}) =>
    ConversationModel(
      id: kConv,
      type: type,
      name: name,
      participants: participants,
      unreadCount: 0,
      createdAt: DateTime(2026, 1, 1),
    );

Future<void> _pump(
  WidgetTester tester,
  ConversationModel? conv, {
  Map<String, String> names = const {kBob: 'Bob'},
  Map<String, UserStatus> statuses = const {},
  Map<String, Object> prefs = const {},
  ChatState? chat,
}) async {
  final overrides = await baseOverrides(
    names: names,
    statuses: statuses,
    prefs: prefs,
    chat: chat == null ? null : FakeChatNotifier(chat),
  );
  await tester.pumpWidget(ProviderScope(
    overrides: [
      ...overrides,
      conversationProvider.overrideWith((ref, id) => conv),
    ],
    child: wrapWidget(Scaffold(
      appBar: ChatScreenAppBar(
        conversationId: kConv,
        currentUserId: kMe,
        onSearch: () {},
        onClearHistory: () {},
        onDeleteConversation: () {},
      ),
    )),
  ));
  await tester.pumpAndSettle();
}

void main() {
  group('ChatScreenAppBar — direct', () {
    testWidgets('title = peer name; online status localized', (tester) async {
      await _pump(tester, _conv(),
          statuses: const {kBob: UserStatus(userId: kBob, online: true)});

      expect(find.text('Bob'), findsOneWidget);
      expect(find.text(en.statusOnline), findsOneWidget);
      expect(find.byIcon(Icons.call_rounded), findsOneWidget);
      expect(find.byIcon(Icons.videocam_rounded), findsOneWidget);
    });

    testWidgets('offline with lastSeen → "active Nm ago"', (tester) async {
      await _pump(tester, _conv(), statuses: {
        kBob: UserStatus(
            userId: kBob,
            online: false,
            lastSeen: DateTime.now().subtract(const Duration(minutes: 5))),
      });

      expect(find.text(en.lastSeenMinutes(5)), findsOneWidget);
    });

    testWidgets('offline without lastSeen → offline label', (tester) async {
      await _pump(tester, _conv());
      expect(find.text(en.statusOffline), findsOneWidget);
    });

    testWidgets('lastSeen hours ago', (tester) async {
      await _pump(tester, _conv(), statuses: {
        kBob: UserStatus(
            userId: kBob,
            online: false,
            lastSeen: DateTime.now().subtract(const Duration(hours: 3))),
      });
      expect(find.text(en.lastSeenHours(3)), findsOneWidget);
    });

    testWidgets('lastSeen days ago', (tester) async {
      await _pump(tester, _conv(), statuses: {
        kBob: UserStatus(
            userId: kBob,
            online: false,
            lastSeen: DateTime.now().subtract(const Duration(days: 2))),
      });
      expect(find.text(en.lastSeenDays(2)), findsOneWidget);
    });

    testWidgets('nickname wins over display name', (tester) async {
      await _pump(tester, _conv(), prefs: const {
        'chat_nicknames_$kConv': ['$kBob:Bobby']
      });
      expect(find.text('Bobby'), findsOneWidget);
    });

    testWidgets('unresolvable peer → localized default, never the raw id',
        (tester) async {
      await _pump(tester, _conv(), names: const {});

      expect(find.text(en.chatDefaultTitle), findsOneWidget);
      expectNoRaw(tester, [kBob]);
    });
  });

  group('ChatScreenAppBar — group', () {
    testWidgets('group name + localized member count + group call actions',
        (tester) async {
      await _pump(tester,
          _conv(type: 'group', name: 'Team', participants: const [kMe, kBob, kCarol]));

      expect(find.text('Team'), findsOneWidget);
      expect(find.text(en.membersCount(3)), findsOneWidget);
      expect(find.byTooltip(en.groupCallStartAction), findsNWidgets(2));
    });

    testWidgets('unnamed group → localized default', (tester) async {
      await _pump(tester, _conv(type: 'group'));
      expect(find.text(en.conversationDefault), findsOneWidget);
    });
  });

  group('ChatScreenAppBar — AI', () {
    testWidgets('AI thread: localized title, persona subtitle, no call buttons',
        (tester) async {
      await _pump(
        tester,
        _conv(participants: const [kMe, _aiBot]),
        chat: const ChatState(
            messages: [], hasMore: false, aiPersonaName: 'Jarvis'),
      );

      expect(find.text(en.aiThreadUntitled), findsOneWidget);
      expect(find.text('Jarvis'), findsOneWidget);
      expect(find.byIcon(Icons.call_rounded), findsNothing);
      expectNoRaw(tester, [_aiBot]);
    });
  });

  testWidgets('conversation not loaded yet → default title, no crash',
      (tester) async {
    await _pump(tester, null);
    expect(find.text(en.chatDefaultTitle), findsOneWidget);
  });
}
