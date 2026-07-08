// Tests for MessageBubble widget.
//
// Strategy: MessageBubble immediately delegates to SystemMessage when
// message.isSystem is true, bypassing the heavy chatNotifierProvider
// (which requires STOMP + Dio + Firebase). System-message tests are therefore
// stable and fast with minimal provider overrides.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/chat/domain/chat_models.dart';
import 'package:platform_client/features/chat/domain/chat_misc_providers.dart';
import 'package:platform_client/features/chat/ui/widgets/message_bubble.dart';
import 'package:platform_client/features/chat/ui/widgets/message_bubble_parts.dart';
import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/l10n/app_localizations.dart';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Wraps [child] in the minimal scaffolding a widget test needs:
/// MaterialApp (with l10n delegates) + ProviderScope (with [overrides]).
Widget _wrap(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    ),
  );
}

/// Returns a minimal [MessageModel] whose [type] is `'system'`.
MessageModel _systemMessage({
  String content = 'system.group.created',
  String senderId = 'user-abc',
  String conversationId = 'conv-test-1',
}) {
  return MessageModel(
    id: 'msg-001',
    conversationId: conversationId,
    senderId: senderId,
    content: content,
    type: 'system',
    readBy: const [],
    createdAt: DateTime(2024, 6, 1, 10, 0),
  );
}

// ---------------------------------------------------------------------------
// Shared override builder
// ---------------------------------------------------------------------------

/// Builds the minimal set of provider overrides required for a MessageBubble
/// widget test exercising the system-message path (isSystem == true).
///
/// Overrides:
///  - sharedPreferencesProvider  → mock SharedPreferences (empty)
///  - authNotifierProvider       → AsyncData(AuthUnauthenticated)
///  - nicknamesProvider(id)      → empty map via StateProvider
///  - userProfileProvider(id)    → resolves to a fake UserModel
Future<List<Override>> _buildOverrides() async {
  const senderId = 'user-abc';
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();

  return [
    sharedPreferencesProvider.overrideWithValue(prefs),
    authNotifierProvider.overrideWith(
      () => _FakeAuthNotifier(),
    ),
    // Override the entire family so any call with any conversationId returns
    // an empty nicknames map without touching SharedPreferences.
    nicknamesProvider.overrideWith(
      (ref, id) => NicknamesNotifier(ref, id),
    ),
    userProfileProvider(senderId).overrideWith(
      (ref) async => _fakeUser(senderId),
    ),
  ];
}

// ---------------------------------------------------------------------------
// Fake notifiers / helpers
// ---------------------------------------------------------------------------

class _FakeAuthNotifier extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthUnauthenticated();
}

UserModel _fakeUser(String id) => UserModel(
      id: id,
      email: 'test@example.com',
      displayName: 'Test User',
    );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  group('MessageBubble — system message', () {
    testWidgets('renders "group created" system message without a gradient bubble',
        (tester) async {
      // 'system.group.created' → l10n key sysGroupCreated("{actorName} created the group")
      // The widget resolves actorName via userProfileProvider which we override.
      final overrides = await _buildOverrides();
      final message = _systemMessage(content: 'system.group.created');

      await tester.pumpWidget(
        _wrap(
          MessageBubble(
            message: message,
            isSentByMe: false,
          ),
          overrides: overrides,
        ),
      );

      // Allow async providers (authNotifier, userProfile) to resolve.
      await tester.pumpAndSettle();

      // The MessageBubble widget must appear on screen.
      expect(find.byType(MessageBubble), findsOneWidget);

      // A system message renders as a small centered chip, NOT as a gradient
      // bubble. Verify that no Container with a LinearGradient decoration is
      // present in the tree (those are only added in the sent-bubble branch).
      final gradientContainers = tester
          .widgetList<Container>(find.byType(Container))
          .where((c) {
        final deco = c.decoration;
        return deco is BoxDecoration && deco.gradient is LinearGradient;
      });
      expect(
        gradientContainers,
        isEmpty,
        reason: 'System messages must not render as gradient chat bubbles',
      );
    });

    testWidgets('renders a missed voice call system message with a phone Icon',
        (tester) async {
      // 'system.call.missed:voice' → rendered by _CallSystemMessage
      // which always includes an Icon widget (phone or videocam).
      final overrides = await _buildOverrides();
      final message = _systemMessage(content: 'system.call.missed:voice');

      await tester.pumpWidget(
        _wrap(
          MessageBubble(
            message: message,
            isSentByMe: false,
          ),
          overrides: overrides,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(MessageBubble), findsOneWidget);
      // _CallSystemMessage always contains at least one Icon (phone/videocam).
      expect(find.byType(Icon), findsAtLeastNWidgets(1));
    });

    testWidgets('ended call renders the duration from parts[2] (not parts[3])',
        (tester) async {
      // 'system.call.ended:voice:125' → 125s = 02:05. The bug read parts[3]
      // (missing) so it always showed 00:00; secs live at parts[2].
      final overrides = await _buildOverrides();
      final message = _systemMessage(content: 'system.call.ended:voice:125');

      await tester.pumpWidget(
        _wrap(
          MessageBubble(message: message, isSentByMe: false),
          overrides: overrides,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('02:05'), findsOneWidget);
      expect(find.textContaining('00:00'), findsNothing);
    });
  });

  group('ReplyQuote — sanitized preview (no-raw-system-data-in-ui)', () {
    testWidgets('humanizes a system-code reply instead of showing the raw code',
        (tester) async {
      await tester.pumpWidget(
        _wrap(const ReplyQuote(
          preview: ReplyPreview(
            senderId: 'user-abc',
            content: 'system.group.created',
          ),
        )),
      );
      await tester.pumpAndSettle();

      // Never leak the raw system.* code; show the localized label.
      expect(find.text('system.group.created'), findsNothing);
      expect(find.text('Create group'), findsOneWidget);
    });

    testWidgets('labels a media (upload URL) reply instead of showing the URL',
        (tester) async {
      await tester.pumpWidget(
        _wrap(const ReplyQuote(
          preview: ReplyPreview(
            senderId: 'user-abc',
            content: '/api/uploads/6e8f0011223344.jpg',
          ),
        )),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('/api/uploads/'), findsNothing);
      expect(find.text('[Photo]'), findsOneWidget);
    });
  });
}
