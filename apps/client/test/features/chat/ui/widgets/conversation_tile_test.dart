// Widget tests for ConversationTile (conversation list row): title
// resolution, unread badge, mute/blocked icons and the last-message preview,
// which must never show a raw system code, user id, upload URL or JSON
// (`.claude/rules/no-raw-system-data-in-ui.md`).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/ui/widgets/conversation_tile.dart';

import 'chat_widget_harness.dart';

const _aiBot = 'ai-bot-000000000000000000000001';

ConversationModel _conv({
  String type = 'direct',
  String? name,
  List<String> participants = const [kMe, kBob],
  LastMessageModel? last,
  int unread = 0,
  bool muted = false,
  int? muteExpiresAt,
  bool blocked = false,
}) =>
    ConversationModel(
      id: kConv,
      type: type,
      name: name,
      participants: participants,
      lastMessage: last,
      unreadCount: unread,
      createdAt: DateTime(2026, 1, 1),
      isMuted: muted,
      muteExpiresAt: muteExpiresAt,
      isBlocked: blocked,
    );

LastMessageModel _last(String content,
        {String senderId = kBob, String? type, bool recalled = false}) =>
    LastMessageModel(
      content: content,
      senderId: senderId,
      createdAt: DateTime(2026, 1, 2),
      type: type,
      recalled: recalled,
    );

Future<void> _pump(
  WidgetTester tester,
  ConversationModel conv, {
  Map<String, String> names = const {kBob: 'Bob', kCarol: 'Carol'},
  Map<String, Object> prefs = const {},
}) async {
  final overrides = await baseOverrides(names: names, prefs: prefs);
  await tester.pumpWidget(
      wrapWidget(ConversationTile(conv: conv), overrides: overrides));
  await tester.pumpAndSettle();
}

void main() {
  group('ConversationTile — title', () {
    testWidgets('DM shows the peer display name', (tester) async {
      await _pump(tester, _conv());
      expect(find.text('Bob'), findsOneWidget);
    });

    testWidgets('DM nickname wins over display name', (tester) async {
      await _pump(tester, _conv(), prefs: const {
        'chat_nicknames_$kConv': ['$kBob:Bobby']
      });
      expect(find.text('Bobby'), findsOneWidget);
      expect(find.text('Bob'), findsNothing);
    });

    testWidgets('unresolvable peer shows a placeholder, never the raw id',
        (tester) async {
      await _pump(tester, _conv(), names: const {});
      expectNoRaw(tester, [kBob]);
    });

    testWidgets('group without a name → localized default', (tester) async {
      await _pump(tester,
          _conv(type: 'group', participants: const [kMe, kBob, kCarol]));
      expect(find.text(en.conversationDefault), findsOneWidget);
    });

    testWidgets('AI chat is titled by l10n, not its bot id', (tester) async {
      await _pump(tester, _conv(participants: const [kMe, _aiBot]));
      expect(find.text(en.aiAssistant), findsOneWidget);
      expectNoRaw(tester, [_aiBot]);
    });
  });

  group('ConversationTile — unread / mute / blocked', () {
    testWidgets('unread badge shows the count', (tester) async {
      await _pump(tester, _conv(unread: 7, last: _last('ping')));
      expect(find.text('7'), findsOneWidget);
    });

    testWidgets('no badge at zero unread', (tester) async {
      await _pump(tester, _conv(unread: 0, last: _last('ping')));
      expect(find.text('0'), findsNothing);
    });

    testWidgets('bot conversations never show an unread badge',
        (tester) async {
      await _pump(tester,
          _conv(participants: const [kMe, _aiBot], unread: 4, last: _last('x')));
      expect(find.text('4'), findsNothing);
    });

    testWidgets('muted forever shows the icon without a countdown',
        (tester) async {
      await _pump(tester,
          _conv(muted: true, muteExpiresAt: 9200000000000000));
      expect(find.byIcon(Icons.volume_off_rounded), findsOneWidget);
      expect(find.textContaining('min'), findsNothing);
    });

    testWidgets('timed mute shows remaining minutes', (tester) async {
      final in10 = DateTime.now()
          .add(const Duration(minutes: 9, seconds: 30))
          .millisecondsSinceEpoch;
      await _pump(tester, _conv(muted: true, muteExpiresAt: in10));
      expect(find.text(en.durationShortMinutes(10)), findsOneWidget);
    });

    testWidgets('blocked shows the block icon instead of mute',
        (tester) async {
      await _pump(tester, _conv(blocked: true, muted: true));
      expect(find.byIcon(Icons.block_rounded), findsOneWidget);
      expect(find.byIcon(Icons.volume_off_rounded), findsNothing);
    });
  });

  group('ConversationTile — last message preview (sanitized)', () {
    testWidgets('own DM text gets the localized "You:" prefix',
        (tester) async {
      await _pump(tester, _conv(last: _last('on my way', senderId: kMe)));
      expect(find.text('${en.youColon} on my way'), findsOneWidget);
    });

    testWidgets('peer DM text has no prefix', (tester) async {
      await _pump(tester, _conv(last: _last('on my way')));
      expect(find.text('on my way'), findsOneWidget);
    });

    testWidgets('groups never get the "You:" prefix', (tester) async {
      await _pump(
          tester,
          _conv(
              type: 'group',
              name: 'Team',
              participants: const [kMe, kBob, kCarol],
              last: _last('hi all', senderId: kMe)));
      expect(find.text('hi all'), findsOneWidget);
    });

    testWidgets('system code is humanized with names, no code / user ids',
        (tester) async {
      await _pump(
          tester,
          _conv(
              type: 'group',
              name: 'Team',
              participants: const [kMe, kBob, kCarol],
              last: _last('system.nickname.changed:$kCarol:Caz',
                  type: 'system')));

      expect(find.text(en.sysNicknameSetOther('Bob', 'Carol', 'Caz')),
          findsOneWidget);
      expectNoRaw(tester, ['system.', kBob, kCarol]);
    });

    testWidgets('own system event in a DM gets no "You:" prefix',
        (tester) async {
      await _pump(
          tester,
          _conv(
              last: _last('system.theme.changed:#ff0000',
                  senderId: kMe, type: 'system')));

      expect(find.text(en.sysThemeChanged(en.you)), findsOneWidget);
      expect(find.textContaining(en.youColon), findsNothing);
    });

    testWidgets('typeless system code (legacy) is still humanized',
        (tester) async {
      await _pump(tester,
          _conv(last: _last('system.message.pinned:$kCarol', senderId: 'system')));
      expect(find.text(en.sysPinnedMessage('Carol')), findsOneWidget);
      expectNoRaw(tester, ['system.', kCarol]);
    });

    testWidgets('unknown system code → generic label', (tester) async {
      await _pump(tester,
          _conv(last: _last('system.future:$kCarol', type: 'system')));
      expect(find.text(en.pinnedSystemMessage), findsOneWidget);
      expectNoRaw(tester, ['system.', kCarol]);
    });

    testWidgets('file type → [File] label, no JSON / URL', (tester) async {
      await _pump(tester, _conv(last: _last(kFileJson, type: 'file')));
      expect(find.text('[${en.attachFile}]'), findsOneWidget);
      expectNoRaw(tester, ['{"url"', '/api/uploads/', 'salary.pdf']);
    });

    testWidgets('typeless file JSON (legacy) → [File] label', (tester) async {
      await _pump(tester, _conv(last: _last(kFileJson)));
      expect(find.text('[${en.attachFile}]'), findsOneWidget);
      expectNoRaw(tester, ['{"url"', '/api/uploads/']);
    });

    testWidgets('typeless upload URL → [Photo] label', (tester) async {
      await _pump(tester, _conv(last: _last(kUploadUrl)));
      expect(find.text('[${en.attachPhoto}]'), findsOneWidget);
      expectNoRaw(tester, ['/api/uploads/']);
    });

    testWidgets('typeless unknown upload → generic attachment label',
        (tester) async {
      await _pump(tester, _conv(last: _last('/api/uploads/6e8f00aa.bin')));
      expect(find.text(en.attachmentLabel), findsOneWidget);
      expectNoRaw(tester, ['/api/uploads/']);
    });

    testWidgets('image / sticker / voice types → bracketed labels',
        (tester) async {
      await _pump(tester, _conv(last: _last(kUploadUrl, type: 'image')));
      expect(find.text('[${en.attachPhoto}]'), findsOneWidget);

      await _pump(tester, _conv(last: _last('😀', type: 'sticker')));
      expect(find.text('[${en.attachSticker}]'), findsOneWidget);

      await _pump(tester,
          _conv(last: _last('/api/uploads/a.m4a', type: 'voice')));
      expect(find.text('[${en.attachVoice}]'), findsOneWidget);
    });

    testWidgets('meeting summary JSON → localized label', (tester) async {
      await _pump(
          tester,
          _conv(
              last: _last('{"overview":"Q3","actionItems":[]}',
                  type: 'meeting_summary')));
      expect(find.text('[${en.meetingSummaryTitle}]'), findsOneWidget);
      expectNoRaw(tester, ['"overview"']);
    });

    testWidgets('recalled → recalled label, never the old text',
        (tester) async {
      await _pump(tester,
          _conv(last: _last('old secret', recalled: true)));
      expect(find.text(en.messageRecalled), findsOneWidget);
      expect(find.textContaining('old secret'), findsNothing);
    });

    testWidgets('no last message → no subtitle', (tester) async {
      await _pump(tester, _conv());
      expect(find.byType(ListTile), findsOneWidget);
      expect(tester.widget<ListTile>(find.byType(ListTile)).subtitle, isNull);
    });
  });
}
