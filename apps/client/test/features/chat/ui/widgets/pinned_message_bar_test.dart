// Widget tests for PinnedMessageBar (chat header): preview is always
// sanitized per `docs/engineering/no-raw-system-data-in-ui.md`, and the unpin
// button only appears with permission.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/ui/widgets/pinned_message_bar.dart';

import 'chat_widget_harness.dart';

Future<void> _pump(
  WidgetTester tester,
  PinnedMessageModel pinned, {
  VoidCallback? onTap,
  VoidCallback? onDismiss,
}) async {
  await tester.pumpWidget(wrapWidget(PinnedMessageBar(
    pinned: pinned,
    onTap: onTap ?? () {},
    onDismiss: onDismiss,
  )));
  await tester.pump();
}

PinnedMessageModel _pin(String content, {String type = 'text'}) =>
    PinnedMessageModel(id: 'p1', senderId: kBob, content: content, type: type);

void main() {
  group('PinnedMessageBar — preview', () {
    testWidgets('shows the localized title and trimmed text', (tester) async {
      await _pump(tester, _pin('  launch at 9am  '));

      expect(find.text(en.pinnedMessageTitle), findsOneWidget);
      expect(find.text('launch at 9am'), findsOneWidget);
    });

    testWidgets('empty text falls back to an em dash', (tester) async {
      await _pump(tester, _pin('   '));

      expect(find.text('—'), findsOneWidget);
    });

    testWidgets('system message → generic label, never the code or user id',
        (tester) async {
      await _pump(tester,
          _pin('system.nickname.changed:$kCarol:Caz', type: 'system'));

      expect(find.text(en.pinnedSystemMessage), findsOneWidget);
      expectNoRaw(tester, ['system.', kCarol]);
    });

    final typed = <String, String Function()>{
      'image': () => '[${en.attachPhoto}]',
      'video': () => '[${en.attachVideo}]',
      'file': () => '[${en.attachFile}]',
      'voice': () => '[${en.attachVoice}]',
      'sticker': () => '[${en.attachSticker}]',
    };
    typed.forEach((type, label) {
      testWidgets('$type → ${label()} label, no upload URL / JSON',
          (tester) async {
        await _pump(
            tester, _pin(type == 'file' ? kFileJson : kUploadUrl, type: type));

        expect(find.text(label()), findsOneWidget);
        expectNoRaw(tester, ['/api/uploads/', '{"url"', 'salary.pdf']);
      });
    });

    testWidgets('meeting summary → localized label, not the JSON payload',
        (tester) async {
      await _pump(
          tester,
          _pin('{"overview":"Q3 plan","keyPoints":[]}',
              type: 'meeting_summary'));

      expect(find.text('[${en.meetingSummaryTitle}]'), findsOneWidget);
      expectNoRaw(tester, ['"overview"', 'Q3 plan']);
    });

    testWidgets('AI answer shows its text (empty → em dash)', (tester) async {
      await _pump(tester, _pin(' The answer is 42 ', type: 'ai'));
      expect(find.text('The answer is 42'), findsOneWidget);

      await _pump(tester, _pin('  ', type: 'ai'));
      expect(find.text('—'), findsOneWidget);
    });

    // A pin whose payload lacks `type` defaults to 'text' (PinnedMessageModel
    // .fromJson); like web's humanizeMessagePreview, the content is sniffed
    // (system code, upload URL, file JSON) so legacy pins never leak.
    testWidgets(
      'typeless pin holding a system code is still humanized',
      (tester) async {
        await _pump(tester, _pin('system.message.pinned:$kCarol'));

        expectNoRaw(tester, ['system.', kCarol]);
      },
    );

    testWidgets(
      'typeless pin holding an upload URL shows a label',
      (tester) async {
        await _pump(tester, _pin(kUploadUrl));

        expectNoRaw(tester, ['/api/uploads/']);
      },
    );

    testWidgets(
      'typeless pin holding file JSON shows a label',
      (tester) async {
        await _pump(tester, _pin(kFileJson));

        expectNoRaw(tester, ['{"url"', '/api/uploads/']);
      },
    );
  });

  group('PinnedMessageBar — actions', () {
    testWidgets('tap jumps; close button unpins', (tester) async {
      var taps = 0;
      var dismissed = 0;
      await _pump(tester, _pin('hello'),
          onTap: () => taps++, onDismiss: () => dismissed++);

      await tester.tap(find.text('hello'));
      await tester.tap(find.byTooltip(en.unpinMessage));

      expect(taps, 1);
      expect(dismissed, 1);
    });

    testWidgets('no unpin permission → no close button', (tester) async {
      await _pump(tester, _pin('hello'));

      expect(find.byTooltip(en.unpinMessage), findsNothing);
      expect(find.byIcon(Icons.close_rounded), findsNothing);
    });
  });
}
