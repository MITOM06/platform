// Shared scaffolding for the chat-UI widget tests in this folder.
//
// Wraps a widget in ProviderScope + MaterialApp (real l10n delegates, `en`)
// and fakes the providers chat widgets watch (auth, profiles, nicknames,
// status, assistant, the per-conversation ChatNotifier) so no Dio / STOMP /
// Firebase is touched.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/features/assistant/data/assistant_repository.dart';
import 'package:platform_client/features/assistant/state/assistant_provider.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/domain/chat_provider.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';
import 'package:platform_client/l10n/app_localizations.dart';

/// English strings — every assertion compares against l10n, never a literal.
final AppLocalizations en = lookupAppLocalizations(const Locale('en'));

const kMe = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const kBob = '6a3f1c2d4e5f6a7b8c9d0e1f';
const kCarol = '6b4f1c2d4e5f6a7b8c9d0e2a';
const kConv = 'conv-1';

/// Raw values that must never reach the screen.
const kUploadUrl = '/api/uploads/6e8f00aabbccdd.jpg';
const kFileJson =
    '{"url":"/api/uploads/6e8f00aa","name":"salary.pdf","size":"2048"}';

Widget wrapWidget(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Scaffold(body: child),
    ),
  );
}

class FakeAuthNotifier extends AuthNotifier {
  final String? userId;
  FakeAuthNotifier(this.userId);

  @override
  Future<AuthState> build() async => userId == null
      ? const AuthUnauthenticated()
      : AuthAuthenticated(
          UserModel(id: userId!, email: 'me@x.io', displayName: 'Me'));
}

class FakeAssistantNotifier extends AssistantNotifier {
  @override
  Future<AssistantInfo?> build() async => null;
}

/// Records the notifier calls a widget makes; never hits the network.
class FakeChatNotifier extends ChatNotifier {
  FakeChatNotifier(this.initial);
  final ChatState initial;
  final List<String> calls = [];

  @override
  Future<ChatState> build(String conversationId) async => initial;

  @override
  Future<void> toggleReaction(String messageId, String emoji) async =>
      calls.add('react:$messageId:$emoji');

  @override
  Future<void> recallMessage(String messageId) async =>
      calls.add('recall:$messageId');

  @override
  Future<void> deleteForMe(String messageId) async =>
      calls.add('delete:$messageId');

  @override
  Future<void> unpinMessage(String messageId) async =>
      calls.add('unpin:$messageId');

  @override
  Future<void> retrySend(String messageId) async =>
      calls.add('retry:$messageId');
}

/// Common overrides. [names] maps user id → display name; ids absent from it
/// fail to resolve (profile lookup errors), which is the case where a raw id
/// would most likely leak.
Future<List<Override>> baseOverrides({
  String? currentUserId = kMe,
  Map<String, String> names = const {},
  Map<String, UserStatus> statuses = const {},
  FakeChatNotifier? chat,
  Map<String, Object> prefs = const {},
}) async {
  SharedPreferences.setMockInitialValues(prefs);
  final sp = await SharedPreferences.getInstance();
  return [
    sharedPreferencesProvider.overrideWithValue(sp),
    authNotifierProvider.overrideWith(() => FakeAuthNotifier(currentUserId)),
    assistantProvider.overrideWith(FakeAssistantNotifier.new),
    userProfileProvider.overrideWith((ref, id) async {
      final name = names[id];
      if (name == null) throw StateError('no profile $id');
      return UserModel(id: id, email: '$id@x.io', displayName: name);
    }),
    userStatusProvider.overrideWith((ref, id) async =>
        statuses[id] ?? UserStatus(userId: id, online: false)),
    if (chat != null) chatNotifierProvider(kConv).overrideWith(() => chat),
  ];
}

MessageModel msg({
  String id = 'm1',
  String senderId = kBob,
  required String content,
  String type = 'text',
  ReplyPreview? replyPreview,
  bool recalled = false,
  bool isStreaming = false,
  bool isThinking = false,
  bool sendFailed = false,
  DateTime? editedAt,
  List<ReactionModel> reactions = const [],
  List<String> readBy = const [],
  List<String> activeTools = const [],
}) =>
    MessageModel(
      id: id,
      conversationId: kConv,
      senderId: senderId,
      content: content,
      type: type,
      readBy: readBy,
      createdAt: DateTime(2026, 1, 2, 9, 30),
      replyPreview: replyPreview,
      recalled: recalled,
      isStreaming: isStreaming,
      isThinking: isThinking,
      sendFailed: sendFailed,
      editedAt: editedAt,
      reactions: reactions,
      activeTools: activeTools,
    );

/// Every visible [Text]/[RichText] string in the tree, joined — used to
/// assert that a raw value appears nowhere on screen.
String allText(WidgetTester tester) {
  final buf = StringBuffer();
  for (final w in tester.widgetList(find.byType(RichText))) {
    buf.writeln((w as RichText).text.toPlainText());
  }
  for (final w in tester.widgetList(find.byType(EditableText))) {
    buf.writeln((w as EditableText).controller.text);
  }
  return buf.toString();
}

/// Asserts none of [raws] is rendered anywhere on screen.
void expectNoRaw(WidgetTester tester, List<String> raws) {
  final shown = allText(tester);
  for (final raw in raws) {
    expect(shown.contains(raw), isFalse,
        reason: 'raw "$raw" leaked to the UI:\n$shown');
  }
}
