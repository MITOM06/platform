// Renders screens to PNG with the real Geist font, in light and dark, so the
// mobile UI can be reviewed against docs/design-system.md without a simulator.
//
//   DESIGN_SHOTS=1 flutter test test/design/design_shots_test.dart
//
// Images land in build/design_shots/. Skipped unless DESIGN_SHOTS is set, so
// it never slows down or flakes the normal suite. Screens are pumped without a
// backend, so data-driven ones show their loading / empty / error chrome.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/providers/theme_provider.dart';
import 'package:platform_client/core/theme/app_theme.dart';
import 'package:platform_client/core/widgets/pon_widgets.dart';
import 'package:platform_client/features/admin/ui/admin_screen.dart';
import 'package:platform_client/features/ai_context/ui/ai_context_screen.dart';
import 'package:platform_client/features/ai_hub/ui/ai_hub_screen.dart';
import 'package:platform_client/features/assistant/ui/assistant_settings_screen.dart';
import 'package:platform_client/features/assistant/ui/assistant_setup_screen.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/auth/ui/forgot_password_screen.dart';
import 'package:platform_client/features/auth/ui/login_screen.dart';
import 'package:platform_client/features/auth/ui/new_password_screen.dart';
import 'package:platform_client/features/auth/ui/theme_onboarding_screen.dart';
import 'package:platform_client/features/auth/ui/verify_otp_screen.dart';
import 'package:platform_client/features/chat/domain/chat_misc_providers.dart';
import 'package:platform_client/features/chat/domain/chat_models.dart';
import 'package:platform_client/features/chat/ui/ai_persona_screen.dart';
import 'package:platform_client/features/chat/ui/archived_chats_screen.dart';
import 'package:platform_client/features/chat/ui/blocked_conversations_screen.dart';
import 'package:platform_client/features/chat/ui/conversation_list_screen.dart';
import 'package:platform_client/features/chat/ui/explore_screen.dart';
import 'package:platform_client/features/chat/ui/kb_screen.dart';
import 'package:platform_client/features/chat/ui/new_conversation_screen.dart';
import 'package:platform_client/features/chat/ui/new_group_screen.dart';
import 'package:platform_client/features/chat/ui/widgets/message_bubble.dart';
import 'package:platform_client/features/friends/ui/friends_screen.dart';
import 'package:platform_client/features/help/ui/help_screen.dart';
import 'package:platform_client/features/integrations/ui/integrations_screen.dart';
import 'package:platform_client/features/profile/ui/edit_profile_screen.dart';
import 'package:platform_client/features/reminders/reminders_screen.dart';
import 'package:platform_client/features/settings/ui/legal_screen.dart';
import 'package:platform_client/features/settings/ui/security_settings_screen.dart';
import 'package:platform_client/features/settings/ui/settings_screen.dart';
import 'package:platform_client/features/settings/ui/token_usage_screen.dart';
import 'package:platform_client/features/skills/ui/skills_screen.dart';
import 'package:platform_client/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'meeting_shots.dart';

const _size = Size(390, 844); // iPhone 15/16/17 logical size
final _outDir = Directory('build/design_shots');

class _FakeAuth extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(
        UserModel(
          id: 'u-1',
          email: 'khang@pon.vn',
          displayName: 'Trần Phúc Khang',
        ),
      );
}

Future<void> _loadFonts() async {
  Future<void> family(String name, List<String> assets) async {
    final loader = FontLoader(name);
    for (final a in assets) {
      loader.addFont(rootBundle.load(a));
    }
    await loader.load();
  }

  await family('Geist', [
    'assets/fonts/Geist-Regular.ttf',
    'assets/fonts/Geist-Medium.ttf',
    'assets/fonts/Geist-SemiBold.ttf',
    'assets/fonts/Geist-Bold.ttf',
  ]);
  await family('GeistMono', [
    'assets/fonts/GeistMono-Regular.ttf',
    'assets/fonts/GeistMono-Medium.ttf',
  ]);
  // Material icons ship with the SDK, not the app bundle, under test.
  final flutterRoot = Platform.environment['FLUTTER_ROOT'];
  final icons = File(
    '$flutterRoot/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  if (flutterRoot != null && icons.existsSync()) {
    final loader = FontLoader('MaterialIcons')
      ..addFont(Future.value(ByteData.sublistView(icons.readAsBytesSync())));
    await loader.load();
  }
}

/// A gallery of the shared primitives — the fastest way to see the system.
class _Gallery extends StatelessWidget {
  const _Gallery();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Thành phần dùng chung')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Tiêu đề trang 24 / 600',
              style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: scheme.onSurface)),
          const SizedBox(height: 4),
          const Text('Nội dung 14 / 400. Trợ lý trả lời dựa trên tài liệu.',
              style: TextStyle(fontSize: 14)),
          Text('Chú thích 12, màu phụ',
              style: TextStyle(
                  fontSize: 12, color: AppTheme.mutedText(context))),
          const Text('MANAGE_DEPARTMENTS',
              style: TextStyle(fontFamily: AppTheme.fontMono, fontSize: 13)),
          const SizedBox(height: 16),
          PonButton(onPressed: () {}, child: const Text('Lưu thay đổi')),
          const SizedBox(height: 10),
          FilledButton(onPressed: () {}, child: const Text('FilledButton')),
          const SizedBox(height: 10),
          Row(children: [
            OutlinedButton(onPressed: () {}, child: const Text('Xuất file')),
            const SizedBox(width: 8),
            TextButton(onPressed: () {}, child: const Text('Bỏ qua')),
            const SizedBox(width: 8),
            ElevatedButton(onPressed: () {}, child: const Text('Elevated')),
          ]),
          const SizedBox(height: 16),
          PonTextField(
            controller: TextEditingController(),
            labelText: 'Email công ty',
            prefixIcon: Icons.mail_rounded,
          ),
          const SizedBox(height: 10),
          TextField(
            controller: TextEditingController(text: 'khang@pon.vn'),
            decoration: const InputDecoration(labelText: 'TextField mặc định'),
          ),
          const SizedBox(height: 16),
          PonCard(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Giới hạn token hằng tháng',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: scheme.onSurface)),
                  const SizedBox(height: 4),
                  Text('Đã dùng 101.824 trên 500.000 token.',
                      style: TextStyle(
                          fontSize: 14, color: AppTheme.mutedText(context))),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          ListTile(
            leading: const Icon(Icons.group_rounded),
            title: const Text('Phòng Kế toán'),
            subtitle: const Text('Dũng: mai họp lúc 9h nhé'),
            trailing: Switch(value: true, onChanged: (_) {}),
          ),
          Row(children: [
            const Chip(label: Text('Chip')),
            const SizedBox(width: 8),
            Checkbox(value: true, onChanged: (_) {}),
            const SizedBox(width: 8),
            const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2)),
          ]),
        ],
      ),
    );
  }
}

MessageModel _msg(String id, String sender, String text,
        {String type = 'text'}) =>
    MessageModel(
      id: id,
      conversationId: 'c-1',
      senderId: sender,
      content: text,
      type: type,
      readBy: const [],
      createdAt: DateTime(2026, 10, 1, 20, 14),
    );

/// A chat thread built from the real bubble widget.
class _ChatGallery extends StatelessWidget {
  const _ChatGallery();

  @override
  Widget build(BuildContext context) {
    const ai = 'ai-bot-000000000000000000000001';
    return Scaffold(
      appBar: AppBar(title: const Text('Phòng Kế toán')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 12),
        children: [
          MessageBubble(
              message: _msg('s', 'u-2', 'system.group.created', type: 'system'),
              isSentByMe: false,
              isGroup: true),
          MessageBubble(
              message: _msg('1', 'u-2', 'Mai mình chốt lịch release 2.1 nhé?'),
              isSentByMe: false,
              isGroup: true,
              showSenderName: true),
          MessageBubble(
              message: _msg('2', 'u-1', 'Ok. @AI nhắc cả nhóm lúc 9h sáng mai.'),
              isSentByMe: true,
              isGroup: true),
          MessageBubble(
              message: _msg(
                  '3',
                  ai,
                  'Đã tạo nhắc nhở lúc **09:00** ngày mai cho cả nhóm.\n\n'
                      '- Alice viết release note\n- Bob test regression\n\n'
                      '`MANAGE_DEPARTMENTS`',
                  type: 'ai'),
              isSentByMe: false,
              isGroup: true),
          MessageBubble(
              message: _msg('4', 'u-1', 'Cảm ơn nhé!'),
              isSentByMe: true,
              isGroup: true),
        ],
      ),
    );
  }
}

final _screens = <String, Widget Function()>{
  '09_chat_thread': () => const _ChatGallery(),
  '00_gallery': () => const _Gallery(),
  '01_login': () => const LoginScreen(),
  '03_forgot_password': () => const ForgotPasswordScreen(),
  '04_verify_otp': () => const VerifyOtpScreen(email: 'khang@pon.vn'),
  '05_new_password': () =>
      const NewPasswordScreen(email: 'khang@pon.vn', otp: '123456'),
  '06_theme_onboarding': () => const ThemeOnboardingScreen(),
  '10_conversations': () => const ConversationListScreen(),
  '11_new_conversation': () => const NewConversationScreen(),
  '12_new_group': () => const NewGroupScreen(),
  '13_archived': () => const ArchivedChatsScreen(),
  '14_blocked': () => const BlockedConversationsScreen(),
  '15_explore': () => const ExploreScreen(),
  '16_friends': () => const FriendsScreen(),
  '20_settings': () => const SettingsScreen(),
  '21_security': () => const SecuritySettingsScreen(),
  '22_edit_profile': () => const EditProfileScreen(),
  '23_token_usage': () => const TokenUsageScreen(),
  '24_legal': () => const LegalScreen(),
  '25_help': () => const HelpScreen(),
  '30_ai_hub': () => const AiHubScreen(),
  '31_ai_context': () => const AiContextScreen(),
  '32_ai_persona': () => const AiPersonaScreen(conversationId: 'c-1'),
  '33_kb': () => const KbScreen(conversationId: 'c-1'),
  '34_reminders': () => const RemindersScreen(),
  '35_integrations': () => const IntegrationsScreen(),
  '36_skills': () => const SkillsScreen(),
  '37_assistant_setup': () => const AssistantSetupScreen(),
  '38_assistant_settings': () => const AssistantSettingsScreen(),
  '40_admin': () => const AdminScreen(),
};

void main() {
  final enabled = Platform.environment['DESIGN_SHOTS'] == '1';
  final only = Platform.environment['DESIGN_SHOTS_ONLY'];

  setUpAll(() async {
    if (!enabled) return;
    TestWidgetsFlutterBinding.ensureInitialized();
    await _loadFonts();
    _outDir.createSync(recursive: true);
  });

  for (final entry in _screens.entries) {
    if (only != null && !entry.key.contains(only)) continue;
    for (final dark in [false, true]) {
      final name = '${entry.key}_${dark ? 'dark' : 'light'}';
      testWidgets(name, skip: !enabled, (tester) async {
        tester.view.physicalSize = _size * 2;
        tester.view.devicePixelRatio = 2;
        addTearDown(tester.view.reset);

        SharedPreferences.setMockInitialValues({});
        final prefs = await SharedPreferences.getInstance();
        final key = GlobalKey();

        // Layout overflows and failed network calls are expected here and must
        // not stop the shot from being written.
        final previousOnError = FlutterError.onError;
        FlutterError.onError = (_) {};
        try {
          await tester.pumpWidget(
            ProviderScope(
              overrides: [
                sharedPreferencesProvider.overrideWithValue(prefs),
                authNotifierProvider.overrideWith(() => _FakeAuth()),
                nicknamesProvider
                    .overrideWith((ref, id) => NicknamesNotifier(ref, id)),
                userProfileProvider('u-2').overrideWith(
                  (ref) async => const UserModel(
                      id: 'u-2', email: 'minh@pon.vn', displayName: 'Minh'),
                ),
              ],
              child: RepaintBoundary(
                key: key,
                child: MaterialApp(
                  debugShowCheckedModeBanner: false,
                  theme: AppTheme.lightTheme,
                  darkTheme: AppTheme.darkTheme,
                  themeMode: dark ? ThemeMode.dark : ThemeMode.light,
                  locale: const Locale('vi'),
                  supportedLocales: AppLocalizations.supportedLocales,
                  localizationsDelegates:
                      AppLocalizations.localizationsDelegates,
                  home: entry.value(),
                ),
              ),
            ),
          );
          for (var i = 0; i < 6; i++) {
            await tester.pump(const Duration(milliseconds: 400));
          }

          await tester.runAsync(() async {
            final boundary =
                key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
            final image = await boundary.toImage(pixelRatio: 2);
            final bytes =
                await image.toByteData(format: ui.ImageByteFormat.png);
            File('${_outDir.path}/$name.png')
                .writeAsBytesSync(bytes!.buffer.asUint8List());
          });

          // Dispose before the test ends so pending timers do not fail it.
          await tester.pumpWidget(const SizedBox.shrink());
          await tester.pump(const Duration(seconds: 5));
        } finally {
          FlutterError.onError = previousOnError;
        }
      });
    }
  }

  // Meetings: list, detail, pre-join, removed, room (fake data, real scope).
  meetingShots(enabled: enabled, only: only, out: _outDir);
}
