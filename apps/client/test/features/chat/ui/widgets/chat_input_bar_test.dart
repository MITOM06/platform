// Widget tests for ChatInputBar (composer): which trailing action shows
// (send / mic / quick reaction), callbacks, emoji toggle icon. Also covers
// MentionList (the @mention picker shown above the composer).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/ui/widgets/chat_input_bar.dart';
import 'package:platform_client/features/chat/ui/widgets/mention_list.dart';

import 'chat_widget_harness.dart';

class _Calls {
  int send = 0, attach = 0, emoji = 0, quick = 0;
  final changed = <String>[];
}

Future<_Calls> _pump(
  WidgetTester tester, {
  TextEditingController? controller,
  bool emojiActive = false,
  bool hasAttachments = false,
  bool withVoice = false,
}) async {
  final c = _Calls();
  await tester.pumpWidget(wrapWidget(ChatInputBar(
    controller: controller ?? TextEditingController(),
    onSend: () => c.send++,
    onAttach: () => c.attach++,
    onChanged: c.changed.add,
    onEmojiToggle: () => c.emoji++,
    emojiActive: emojiActive,
    quickReactionEmoji: '🔥',
    onQuickReaction: () => c.quick++,
    hasAttachments: hasAttachments,
    onVoiceSend: withVoice ? (_) async {} : null,
  )));
  return c;
}

void main() {
  group('ChatInputBar', () {
    testWidgets('empty composer: localized hint + quick reaction, no send',
        (tester) async {
      final c = await _pump(tester);

      expect(find.text(en.messageHint), findsOneWidget);
      expect(find.byIcon(Icons.send_rounded), findsNothing);
      await tester.tap(find.text('🔥'));
      expect(c.quick, 1);
      expect(c.send, 0);
    });

    testWidgets('typing reveals send; tapping it sends', (tester) async {
      final c = await _pump(tester);

      await tester.enterText(find.byType(TextField), 'hello');
      await tester.pump();

      expect(c.changed, ['hello']);
      expect(find.byIcon(Icons.send_rounded), findsOneWidget);
      expect(find.text('🔥'), findsNothing);
      await tester.tap(find.byIcon(Icons.send_rounded));
      expect(c.send, 1);
    });

    testWidgets('whitespace-only text does not enable send', (tester) async {
      await _pump(tester);

      await tester.enterText(find.byType(TextField), '   ');
      await tester.pump();

      expect(find.byIcon(Icons.send_rounded), findsNothing);
    });

    testWidgets('clearing the text hides send again', (tester) async {
      final ctrl = TextEditingController();
      await _pump(tester, controller: ctrl);
      ctrl.text = 'x';
      await tester.pump();
      expect(find.byIcon(Icons.send_rounded), findsOneWidget);

      ctrl.clear();
      await tester.pump();
      expect(find.byIcon(Icons.send_rounded), findsNothing);
    });

    testWidgets('staged attachments show send even with empty text',
        (tester) async {
      final c = await _pump(tester, hasAttachments: true);

      await tester.tap(find.byIcon(Icons.send_rounded));
      expect(c.send, 1);
    });

    testWidgets('keyboard submit sends', (tester) async {
      final c = await _pump(tester);

      await tester.enterText(find.byType(TextField), 'go');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      expect(c.send, 1);
    });

    testWidgets('attach and emoji buttons call their callbacks',
        (tester) async {
      final c = await _pump(tester);

      await tester.tap(find.byIcon(Icons.add_photo_alternate_rounded));
      await tester.tap(find.byIcon(Icons.emoji_emotions_rounded));
      expect(c.attach, 1);
      expect(c.emoji, 1);
    });

    testWidgets('emoji panel open → keyboard icon', (tester) async {
      await _pump(tester, emojiActive: true);

      expect(find.byIcon(Icons.keyboard_rounded), findsOneWidget);
      expect(find.byIcon(Icons.emoji_emotions_rounded), findsNothing);
    });

    testWidgets('voice enabled + empty → mic with localized tooltip',
        (tester) async {
      await _pump(tester, withVoice: true);

      expect(find.byTooltip(en.voiceMicTooltip), findsOneWidget);
      expect(find.text('🔥'), findsNothing);
    });
  });

  group('MentionList', () {
    Future<List<String>> pumpList(WidgetTester tester, String query,
        {List<String> ids = const [kBob, kCarol]}) async {
      final picked = <String>[];
      final overrides =
          await baseOverrides(names: const {kBob: 'Bob', kCarol: 'Carol'});
      await tester.pumpWidget(wrapWidget(
        MentionList(participantIds: ids, query: query, onSelected: picked.add),
        overrides: overrides,
      ));
      await tester.pumpAndSettle();
      return picked;
    }

    testWidgets('filters by query (case-insensitive) and returns the name',
        (tester) async {
      final picked = await pumpList(tester, 'CAR');

      expect(find.text('Carol'), findsOneWidget);
      expect(find.text('Bob'), findsNothing);
      await tester.tap(find.text('Carol'));
      expect(picked, ['Carol']);
    });

    testWidgets('empty query lists everyone', (tester) async {
      await pumpList(tester, '');
      expect(find.text('Bob'), findsOneWidget);
      expect(find.text('Carol'), findsOneWidget);
    });

    testWidgets('unresolvable participants are skipped, never shown as ids',
        (tester) async {
      await pumpList(tester, '', ids: const [kBob, '6c9999999999999999999999']);
      expect(find.text('Bob'), findsOneWidget);
      expectNoRaw(tester, ['6c9999999999999999999999']);
    });

    testWidgets('no match → renders nothing', (tester) async {
      await pumpList(tester, 'zzz');
      expect(find.byType(ListTile), findsNothing);
    });
  });
}
