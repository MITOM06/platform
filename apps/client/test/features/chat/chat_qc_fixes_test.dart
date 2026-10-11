import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/ai_action_card_logic.dart';
import 'package:platform_client/features/chat/domain/chat_ai_stream_handler.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/domain/conversation_list_ops.dart';
import 'package:platform_client/features/chat/ui/widgets/ai_action_card.dart';
import 'package:platform_client/features/chat/ui/widgets/message_preview_text.dart';
import 'package:platform_client/features/chat/ui/widgets/system_message_text.dart';
import 'package:platform_client/features/chat/utils/chat_error.dart';
import 'package:platform_client/features/settings/ui/widgets/token_usage_range_selector.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// QC 2026-10-11 chat fixes: pin limit from the server (F16), localized
/// token-usage ranges (F17), named system previews (F18), richer AI action
/// cards (F20), resolved action status wins (F21), AI_FORBIDDEN (F22) and the
/// complete system-notice NEW_MESSAGE payload (F24).

final l10n = lookupAppLocalizations(const Locale('en'));

DioException _err(int status, Map<String, dynamic> body) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.badResponse,
      response: Response(
          requestOptions: RequestOptions(path: '/x'),
          statusCode: status,
          data: body),
    );

Future<BuildContext> _context(WidgetTester tester,
    {Locale locale = const Locale('en'), Widget? child}) async {
  late BuildContext ctx;
  await tester.pumpWidget(MaterialApp(
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    locale: locale,
    home: Scaffold(
      body: Builder(builder: (c) {
        ctx = c;
        return child ?? const SizedBox();
      }),
    ),
  ));
  return ctx;
}

ConversationModel _conv(String id, {int unread = 0}) => ConversationModel(
      id: id,
      type: 'group',
      participants: const ['me', 'u2'],
      unreadCount: unread,
      createdAt: DateTime(2024),
    );

void main() {
  group('pin limit (F16)', () {
    test('uses the server max', () {
      expect(
          chatErrorMessage(
              l10n,
              _err(409, {
                'code': 'PIN_LIMIT_REACHED',
                'params': {'max': 7}
              })),
          l10n.pinLimitReached(7));
    });

    test('falls back to the client limit without params', () {
      expect(chatErrorMessage(l10n, _err(409, {'code': 'PIN_LIMIT_REACHED'})),
          l10n.pinLimitReached(5));
      expect(l10n.pinLimitReached(9), contains('9'));
    });
  });

  testWidgets('token-usage ranges are localized (F17)', (tester) async {
    await _context(tester,
        locale: const Locale('fr'),
        child: TokenUsageRangeSelector(
          presets: const [7, 30],
          activeDays: 7,
          customRange: null,
          onPreset: (_) {},
        ));
    final fr = lookupAppLocalizations(const Locale('fr'));
    expect(find.text(fr.durationShortDays(7)), findsOneWidget);
    expect(find.text('7d'), findsNothing);
  });

  group('system previews name people (F18)', () {
    String name(String id) => const {'u2': 'Bob', 'me': 'You'}[id] ?? '?';

    testWidgets('the conversation-list preview resolves the actor',
        (tester) async {
      final ctx = await _context(tester);
      final last = LastMessageModel(
        content: 'system.member.left',
        senderId: 'u2',
        createdAt: DateTime(2024),
        type: 'system',
      );
      expect(lastMessagePreview(ctx, last, resolveName: name),
          l10n.sysMemberLeft('Bob'));
      // Without a resolver: generic, never the id.
      expect(lastMessagePreview(ctx, last), isNot(contains('u2')));
    });

    test('targets in the content are resolved too', () {
      expect(
          systemPreviewText(l10n, 'system.admin.promoted:u2',
              senderId: 'me', resolveName: name),
          l10n.sysAdminPromotedBy('You', 'Bob'));
      expect(
          systemPreviewText(l10n, 'system.message.pinned:u2',
              resolveName: name),
          l10n.sysPinnedMessage('Bob'));
    });
  });

  group('AI action card details (F20)', () {
    AiPendingAction action(Map<String, dynamic> summary) =>
        AiPendingAction(id: 'a1', summary: summary);

    test('an email shows cc, bcc and the start of the body', () {
      final lines = actionSummaryLines(action({
        'kind': 'send_email',
        'to': 'a@x.com',
        'cc': 'b@x.com',
        'bcc': 'c@x.com',
        'subject': 'Hi',
        'bodyPreview': 'Hello\nthere',
      }));
      expect(lines.map((l) => l.field), [
        ActionSummaryField.to,
        ActionSummaryField.cc,
        ActionSummaryField.bcc,
        ActionSummaryField.subject,
        ActionSummaryField.body,
      ]);
      expect(lines.last.value, 'Hello there');
    });

    test('an event shows its attendees', () {
      final lines = actionSummaryLines(action({
        'kind': 'create_event',
        'title': 'Sync',
        'start': '2026-10-12',
        'attendees': 'a@x.com, b@x.com',
      }));
      expect(lines.map((l) => l.field), [
        ActionSummaryField.title,
        ActionSummaryField.when,
        ActionSummaryField.attendees,
      ]);
      expect(lines.last.value, 'a@x.com, b@x.com');
    });

    test('a generic action lists its humanized fields, never raw ids', () {
      final lines = actionSummaryLines(action({
        'kind': 'generic',
        'tool': 'Create task',
        'fields': [
          {'label': 'Title', 'value': 'Write report'},
          {'label': 'Project', 'value': '64b7f0c2a1b2c3d4e5f60718'},
          {'label': '', 'value': 'x'},
          {'label': 'Due', 'value': ''},
          'junk',
        ],
      }));
      expect(lines, hasLength(1));
      expect(lines.single.field, ActionSummaryField.custom);
      expect(lines.single.label, 'Title');
      expect(lines.single.value, 'Write report');
    });

    test('older servers without the new fields show what they did', () {
      final lines = actionSummaryLines(
          action({'kind': 'send_email', 'to': 'a@x.com', 'subject': 'Hi'}));
      expect(lines.map((l) => l.field),
          [ActionSummaryField.to, ActionSummaryField.subject]);
    });

    test('every field has a localized label; custom ones keep theirs', () {
      expect(aiActionFieldLabel(l10n, const ActionSummaryLine(ActionSummaryField.cc, 'x')),
          l10n.aiActionFieldCc);
      expect(aiActionFieldLabel(l10n, const ActionSummaryLine(ActionSummaryField.bcc, 'x')),
          l10n.aiActionFieldBcc);
      expect(aiActionFieldLabel(l10n, const ActionSummaryLine(ActionSummaryField.body, 'x')),
          l10n.aiActionFieldBody);
      expect(
          aiActionFieldLabel(l10n,
              const ActionSummaryLine(ActionSummaryField.attendees, 'x')),
          l10n.aiActionFieldAttendees);
      expect(
          aiActionFieldLabel(l10n,
              const ActionSummaryLine(ActionSummaryField.custom, 'x', label: 'Title')),
          'Title');
    });
  });

  group('a resolved action status wins over a live pending one (F21)', () {
    const pending = AiPendingAction(id: 'a1', requesterId: 'me');

    test('the saved message resolves the streamed card', () {
      for (final status in [
        AiActionStatus.confirmed,
        AiActionStatus.cancelled,
        AiActionStatus.failed,
        AiActionStatus.expired,
      ]) {
        final merged = mergePendingActions(
            [pending], [AiPendingAction(id: 'a1', status: status)]);
        expect(merged!.single.status, status, reason: '$status');
        expect(merged.single.requesterId, 'me');
      }
    });

    test('a late pending never reopens a resolved card', () {
      final merged = mergePendingActions(
          [const AiPendingAction(id: 'a1', status: AiActionStatus.confirmed)],
          [pending]);
      expect(merged!.single.status, AiActionStatus.confirmed);
    });
  });

  group('AI_FORBIDDEN (F22)', () {
    test('maps to its own sentinel', () {
      expect(aiErrorSentinelFor('AI_FORBIDDEN', 'You do not have access'),
          kAiForbiddenSentinel);
    });

    test('the message model knows it is a failure', () {
      final m = MessageModel(
        id: 'm1',
        conversationId: 'c',
        senderId: kAiBotUserId,
        content: kAiForbiddenSentinel,
        type: 'ai',
        readBy: const [],
        createdAt: DateTime(2024),
      );
      expect(m.isAiForbidden, isTrue);
      expect(m.isAiFailure, isTrue);
      expect(m.isAiError, isFalse);
    });
  });

  group('system notice as a full NEW_MESSAGE payload (F24)', () {
    final payload = <String, dynamic>{
      'type': 'NEW_MESSAGE',
      'conversationId': 'c1',
      'senderName': 'system',
      'content': 'system.member.left',
      'messageId': 'm9',
      'createdAt': '2026-10-11T10:00:00Z',
      'messageType': 'system',
    };

    test('parses into a system-sent notice', () {
      final n = IncomingMessageNotice.fromJson(payload)!;
      expect(n.conversationId, 'c1');
      expect(n.senderId, kSystemSenderId);
      expect(n.content, 'system.member.left');
      expect(n.messageType, 'system');
      expect(n.messageId, 'm9');
      expect(n.createdAt, DateTime.utc(2026, 10, 11, 10));
    });

    test('updates the list row preview, moves it to the top', () {
      final n = IncomingMessageNotice.fromJson(payload)!;
      final list = ConversationListOps.applyIncomingMessage(
        [_conv('c0'), _conv('c1')],
        conversationId: n.conversationId,
        senderId: n.senderId,
        viewing: false,
        content: n.content,
        messageType: n.messageType,
        messageId: n.messageId,
        createdAt: n.createdAt,
      )!;
      expect(list.first.id, 'c1');
      final last = list.first.lastMessage!;
      expect(last.content, 'system.member.left');
      expect(last.type, 'system');
      expect(last.messageId, 'm9');
      expect(last.senderId, kSystemSenderId);
      expect(list.first.lastMessageAt, DateTime.utc(2026, 10, 11, 10));
    });

    test('an actor id, when sent, is kept', () {
      final n = IncomingMessageNotice.fromJson(
          {...payload, 'senderId': 'u2', 'senderName': 'Bob'})!;
      expect(n.senderId, 'u2');
      expect(n.senderName, 'Bob');
    });

    test('the old bare payload still bumps the row, keeping its preview', () {
      final n = IncomingMessageNotice.fromJson(
          {'type': 'NEW_MESSAGE', 'conversationId': 'c1', 'senderName': 'system'})!;
      expect(n.content, isNull);
      expect(n.messageId, isNull);
      expect(n.senderId, kSystemSenderId);
    });

    test('an empty messageId is no id', () {
      final n = IncomingMessageNotice.fromJson({...payload, 'messageId': ''})!;
      expect(n.messageId, isNull);
    });

    test('no conversation, no notice', () {
      expect(IncomingMessageNotice.fromJson({'type': 'NEW_MESSAGE'}), isNull);
    });
  });
}
