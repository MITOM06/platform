import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/domain/conversations_realtime_handlers.dart';
import 'package:platform_client/features/chat/ui/widgets/reply_composer_bar.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// Regression tests for `.claude/rules/no-raw-system-data-in-ui.md`.
///
/// The reply composer and the push-notification body both rendered a message's raw `content`,
/// so replying to (or being notified about) a system event, a voice note or a file printed
/// `system.nickname.changed:<userId>:<value>`, an `/api/uploads/<id>` path or a JSON payload
/// at the user — the notification one landing on the lock screen. Mirrors the web
/// `ReplyBanner.test.tsx` cases so the two platforms stay in sync.

const _systemCode = 'system.nickname.changed:6a3f1c2d4e5f6a7b8c9d0e1f:Bob';
const _uploadUrl = '/api/uploads/6e8f00aabbccdd.m4a';
const _filePayload = '{"url":"/api/uploads/6e8f00aa","name":"salary.pdf","size":1024}';

MessageModel _message({required String content, required String type}) => MessageModel(
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      content: content,
      type: type,
      createdAt: DateTime.now(),
      readBy: const [],
    );

Widget _wrap(Widget child) => MaterialApp(
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Scaffold(body: child),
    );

void main() {
  group('ReplyComposerBar — sanitized preview', () {
    testWidgets('humanizes a system code instead of showing it plus the user id',
        (tester) async {
      await tester.pumpWidget(_wrap(ReplyComposerBar(
        preview: _message(content: _systemCode, type: 'system'),
        onCancel: () {},
      )));

      expect(find.textContaining('system.nickname.changed'), findsNothing);
      expect(find.textContaining('6a3f1c2d4e5f6a7b8c9d0e1f'), findsNothing);
    });

    testWidgets('labels a file message instead of showing its JSON payload',
        (tester) async {
      await tester.pumpWidget(_wrap(ReplyComposerBar(
        preview: _message(content: _filePayload, type: 'file'),
        onCancel: () {},
      )));

      expect(find.textContaining('api/uploads'), findsNothing);
      expect(find.textContaining('salary.pdf'), findsNothing);
    });

    testWidgets('leaves ordinary text alone', (tester) async {
      await tester.pumpWidget(_wrap(ReplyComposerBar(
        preview: _message(content: 'see you at 5', type: 'text'),
        onCancel: () {},
      )));

      expect(find.text('see you at 5'), findsOneWidget);
    });
  });

  group('notificationBodyText — sanitized push body', () {
    late BuildContext ctx;

    Future<void> pumpContext(WidgetTester tester) async {
      await tester.pumpWidget(_wrap(Builder(builder: (c) {
        ctx = c;
        return const SizedBox();
      })));
    }

    testWidgets('a system event never leaks its code or the embedded user id',
        (tester) async {
      await pumpContext(tester);

      final body = notificationBodyText(
        ctx,
        name: 'Alice',
        isMention: false,
        content: _systemCode,
        messageType: 'system',
      );

      expect(body, isNot(contains('system.nickname.changed')));
      expect(body, isNot(contains('6a3f1c2d4e5f6a7b8c9d0e1f')));
      // System events have no meaningful sender — no "Alice: " prefix (parity with web).
      expect(body, isNot(startsWith('Alice:')));
    });

    testWidgets('a voice note never leaks its upload URL', (tester) async {
      await pumpContext(tester);

      final body = notificationBodyText(
        ctx,
        name: 'Alice',
        isMention: false,
        content: _uploadUrl,
        messageType: 'voice',
      );

      expect(body, isNot(contains('api/uploads')));
      expect(body, startsWith('Alice:'));
    });

    testWidgets('a meeting summary never leaks its JSON payload', (tester) async {
      await pumpContext(tester);

      final body = notificationBodyText(
        ctx,
        name: 'Alice',
        isMention: false,
        content: '{"overview":"Q3 layoffs","keyPoints":["cut 20%"]}',
        messageType: 'meeting_summary',
      );

      expect(body, isNot(contains('overview')));
      expect(body, isNot(contains('Q3 layoffs')));
    });

    testWidgets('an ordinary text message still shows sender and text',
        (tester) async {
      await pumpContext(tester);

      final body = notificationBodyText(
        ctx,
        name: 'Alice',
        isMention: false,
        content: 'see you at 5',
        messageType: 'text',
      );

      expect(body, 'Alice: see you at 5');
    });
  });
}
