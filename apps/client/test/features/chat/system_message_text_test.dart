// System-message humanizer (bubble + every preview surface). Covers the new
// codes (disappearing-message timer, admin promote/demote) and the actor-less
// wording for messages chat-service writes as sender "system" — which used to
// render "... created the group".

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/features/chat/ui/widgets/message_preview_text.dart';
import 'package:platform_client/features/chat/ui/widgets/system_message_text.dart';
import 'package:platform_client/features/chat/utils/chat_error.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import 'package:platform_client/l10n/app_localizations_en.dart';

final l10n = AppLocalizationsEn();

String _name(String id) => const {'u1': 'Alice', 'u2': 'Bob'}[id] ?? 'Someone';

String? _text(String content, {String sender = 'system'}) =>
    systemMessageText(l10n, content, senderId: sender, resolveName: _name);

DioException _err(int status, [String? code]) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.badResponse,
      response: Response(
        requestOptions: RequestOptions(path: '/x'),
        statusCode: status,
        data: {
          'error': 'x',
          'message': 'raw English diagnostics',
          if (code != null) 'code': code,
        },
      ),
    );

void main() {
  group('actor-less system messages (sender "system")', () {
    test('group events never start with a placeholder name', () {
      expect(_text('system.group.created'), 'Group created');
      expect(_text('system.member.left'), 'A member left the group');
      expect(_text('system.members.added'), isNot(contains('...')));
    });

    test('with a real actor the name is used', () {
      expect(_text('system.group.created', sender: 'u1'),
          'Alice created the group');
    });
  });

  group('system.autodelete.changed:<seconds>', () {
    test('0 = turned off', () {
      expect(_text('system.autodelete.changed:0'),
          'Disappearing messages turned off');
    });

    test('a timer is humanized with a localized duration', () {
      expect(_text('system.autodelete.changed:86400'),
          'Disappearing messages set to 1 day');
      expect(_text('system.autodelete.changed:604800', sender: 'u1'),
          'Alice set disappearing messages to 7 days');
    });
  });

  group('system.admin.promoted / demoted', () {
    test('names the target, never its id', () {
      final promoted = _text('system.admin.promoted:u2', sender: 'u1');
      expect(promoted, 'Alice made Bob an admin');
      final demoted = _text('system.admin.demoted:u2');
      expect(demoted, 'Bob is no longer an admin');
      expect(demoted, isNot(contains('u2')));
    });
  });

  test('previews of unknown codes use a generic label, never the code', () {
    final preview = systemPreviewText(l10n, 'system.future.thing:6a3f1c2d');
    expect(preview, l10n.pinnedSystemMessage);
    expect(systemPreviewText(l10n, 'system.admin.promoted:6a3f1c2d'),
        isNot(contains('6a3f1c2d')));
  });

  testWidgets('a recalled last message previews as "recalled"', (tester) async {
    late BuildContext ctx;
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Builder(builder: (c) {
        ctx = c;
        return const SizedBox();
      }),
    ));
    final recalled = LastMessageModel(
      content: '',
      senderId: 'u1',
      createdAt: DateTime(2024),
      recalled: true,
    );
    expect(lastMessagePreview(ctx, recalled), l10n.messageRecalled);
    final voice = LastMessageModel(
      content: '/api/uploads/abc.m4a',
      senderId: 'u1',
      createdAt: DateTime(2024),
      type: 'voice',
    );
    expect(lastMessagePreview(ctx, voice), isNot(contains('/api/uploads')));
  });

  group('chat-service error codes → specific localized text', () {
    test('known codes map to their message, never the raw server text', () {
      expect(chatErrorMessage(l10n, _err(403, 'GROUP_ADMIN_REQUIRED')),
          l10n.errGroupAdminRequired);
      expect(chatErrorMessage(l10n, _err(409, 'PIN_LIMIT_REACHED')),
          l10n.pinLimitReached);
      expect(chatErrorMessage(l10n, _err(403, 'USER_BLOCKED')),
          l10n.errChatUserBlocked);
      expect(chatErrorMessage(l10n, _err(400, 'REPLY_TARGET_INVALID')),
          l10n.errReplyTargetInvalid);
      expect(chatErrorMessage(l10n, _err(409, 'LAST_ADMIN_CANNOT_BE_REMOVED')),
          l10n.errLastAdminCannotBeRemoved);
    });

    test('a code-less 429 is the rate-limit message', () {
      expect(chatErrorMessage(l10n, _err(429)), l10n.rateLimitError);
    });

    test('the pin limit text says 5', () {
      expect(l10n.pinLimitReached, contains('5'));
    });
  });
}
