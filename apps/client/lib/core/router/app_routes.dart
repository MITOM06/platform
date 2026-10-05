import 'package:go_router/go_router.dart';
import '../../features/auth/ui/login_screen.dart';
import '../../features/auth/ui/mfa_screen.dart';
import '../../features/auth/ui/accept_invite_screen.dart';
import '../../features/auth/ui/verify_otp_screen.dart';
import '../../features/auth/ui/forgot_password_screen.dart';
import '../../features/auth/ui/new_password_screen.dart';
import '../../features/auth/ui/set_password_screen.dart';
import '../../features/auth/ui/theme_onboarding_screen.dart';
import '../../features/chat/ui/chat_screen.dart';
import '../../features/chat/ui/archived_chats_screen.dart';
import '../../features/chat/ui/blocked_conversations_screen.dart';
import '../../features/home/ui/responsive_home_layout.dart';
import '../../features/chat/presentation/call_screen.dart';
import '../../features/chat/presentation/group_call_screen.dart';
import '../../features/chat/ui/group_info_screen.dart';
import '../../features/chat/ui/new_conversation_screen.dart';
import '../../features/chat/ui/new_group_screen.dart';
import '../../features/profile/ui/user_profile_screen.dart';
import '../../features/profile/ui/edit_profile_screen.dart';
import '../../features/chat/ui/explore_screen.dart';
import '../../features/chat/ui/explore_media_screen.dart';
import '../../features/friends/ui/friends_screen.dart';
import '../../features/settings/ui/settings_screen.dart';
import '../../features/settings/ui/security_settings_screen.dart';
import '../../features/ai_context/ui/ai_context_screen.dart';
import '../../features/chat/ui/ai_persona_screen.dart';
import '../../features/chat/ui/kb_screen.dart';
import '../../features/reminders/reminders_screen.dart';
import '../../features/integrations/ui/integrations_screen.dart';
import '../../features/skills/ui/skills_screen.dart';
import '../../features/ai_hub/ui/ai_hub_screen.dart';
import '../../features/assistant/ui/assistant_setup_screen.dart';
import '../../features/assistant/ui/assistant_settings_screen.dart';
import '../../features/admin/ui/admin_screen.dart';
import '../../features/settings/ui/token_usage_screen.dart';
import '../../features/settings/ui/legal_screen.dart';
import '../../features/help/ui/help_screen.dart';
import '../utils/global_messenger.dart';
import 'page_transitions.dart';

/// Every route of the app, in match order. Split out of `app_router.dart`
/// (redirect/guard logic stays there) to keep both files small. Every route
/// builds its page through [slidePage] so navigation always reads as one
/// horizontal movement — see `page_transitions.dart`.
List<RouteBase> buildAppRoutes() {
  return [
    // ── Public ──────────────────────────────────────────────────────────
    GoRoute(
      path: '/login',
      name: 'login',
      pageBuilder: (context, state) =>
          slidePage(state, const LoginScreen()),
    ),
    GoRoute(
      path: '/invite/:token',
      name: 'invite',
      pageBuilder: (context, state) => slidePage(
        state,
        AcceptInviteScreen(token: state.pathParameters['token']!),
      ),
    ),
    GoRoute(
      path: '/verify-otp',
      name: 'verify-otp',
      pageBuilder: (context, state) {
        final email =
            Uri.decodeComponent(state.uri.queryParameters['email'] ?? '');
        final isForgotPassword =
            state.uri.queryParameters['isForgotPassword'] == 'true';
        return slidePage(
          state,
          VerifyOtpScreen(email: email, isForgotPassword: isForgotPassword),
        );
      },
    ),
    GoRoute(
      path: '/forgot-password',
      name: 'forgot-password',
      pageBuilder: (context, state) =>
          slidePage(state, const ForgotPasswordScreen()),
    ),
    GoRoute(
      path: '/new-password',
      name: 'new-password',
      pageBuilder: (context, state) {
        final email =
            Uri.decodeComponent(state.uri.queryParameters['email'] ?? '');
        final otpParam = state.uri.queryParameters['otp'];
        final otp = otpParam != null ? Uri.decodeComponent(otpParam) : null;
        return slidePage(state, NewPasswordScreen(email: email, otp: otp));
      },
    ),

    // Two-factor step of a privileged sign-in (contract 09). The redirect in
    // app_router.dart makes it reachable only while a challenge is pending.
    GoRoute(
      path: '/mfa',
      name: 'mfa',
      pageBuilder: (context, state) => slidePage(state, const MfaScreen()),
    ),

    // ── Protected ───────────────────────────────────────────────────────
    // Forced first-password step (Google-invite onboarding). The redirect in
    // app_router.dart makes it the only reachable route while
    // `user.mustSetPassword` is true and bounces off it once it is false.
    GoRoute(
      path: '/set-password',
      name: 'set-password',
      pageBuilder: (context, state) =>
          slidePage(state, const SetPasswordScreen()),
    ),
    GoRoute(
      path: '/theme-onboarding',
      name: 'theme-onboarding',
      pageBuilder: (context, state) =>
          slidePage(state, const ThemeOnboardingScreen()),
    ),
    GoRoute(
      path: '/',
      name: 'conversations',
      pageBuilder: (context, state) =>
          slidePage(state, const ResponsiveHomeLayout()),
      routes: [
        GoRoute(
          path: 'chat/:id',
          name: 'chat',
          pageBuilder: (context, state) {
            final id = state.pathParameters['id']!;
            return slidePage(state, ChatScreen(conversationId: id));
          },
        ),
      ],
    ),
    GoRoute(
      path: '/archived',
      name: 'archived',
      pageBuilder: (context, state) =>
          slidePage(state, const ArchivedChatsScreen()),
    ),
    GoRoute(
      path: '/blocked',
      name: 'blocked',
      pageBuilder: (context, state) =>
          slidePage(state, const BlockedConversationsScreen()),
    ),
    GoRoute(
      path: '/settings',
      name: 'settings',
      pageBuilder: (context, state) =>
          slidePage(state, const SettingsScreen()),
    ),
    GoRoute(
      path: '/settings/security',
      name: 'settings-security',
      pageBuilder: (context, state) =>
          slidePage(state, const SecuritySettingsScreen()),
    ),
    GoRoute(
      path: '/new-conversation',
      name: 'new-conversation',
      pageBuilder: (context, state) =>
          slidePage(state, const NewConversationScreen()),
    ),
    GoRoute(
      path: '/new-group',
      name: 'new-group',
      pageBuilder: (context, state) =>
          slidePage(state, const NewGroupScreen()),
    ),
    GoRoute(
      path: '/user/:id',
      name: 'user-profile',
      pageBuilder: (context, state) {
        final id = state.pathParameters['id']!;
        final convId = state.uri.queryParameters['conversationId'];
        return slidePage(
          state,
          UserProfileScreen(userId: id, conversationId: convId),
        );
      },
    ),
    GoRoute(
      path: '/edit-profile',
      name: 'edit-profile',
      pageBuilder: (context, state) =>
          slidePage(state, const EditProfileScreen()),
    ),
    GoRoute(
      path: '/friends',
      name: 'friends',
      pageBuilder: (context, state) =>
          slidePage(state, const FriendsScreen()),
    ),
    GoRoute(
      path: '/group-info/:id',
      name: 'group-info',
      pageBuilder: (context, state) => slidePage(
        state,
        GroupInfoScreen(conversationId: state.pathParameters['id']!),
      ),
    ),
    GoRoute(
      path: '/explore',
      name: 'explore',
      pageBuilder: (context, state) =>
          slidePage(state, const ExploreScreen()),
    ),
    GoRoute(
      path: '/shared-media/:conversationId',
      name: 'shared-media',
      pageBuilder: (context, state) => slidePage(
        state,
        ExploreMediaScreen(
          conversationId: state.pathParameters['conversationId']!,
        ),
      ),
    ),
    GoRoute(
      path: '/ai-context',
      name: 'ai-context',
      pageBuilder: (context, state) =>
          slidePage(state, const AiContextScreen()),
    ),
    GoRoute(
      path: '/ai-persona/:conversationId',
      name: 'ai-persona',
      pageBuilder: (context, state) => slidePage(
        state,
        AiPersonaScreen(
          conversationId: state.pathParameters['conversationId']!,
        ),
      ),
    ),
    GoRoute(
      path: '/kb/:conversationId',
      name: 'kb',
      pageBuilder: (context, state) => slidePage(
        state,
        KbScreen(
          conversationId: state.pathParameters['conversationId']!,
        ),
      ),
    ),
    GoRoute(
      path: '/reminders',
      name: 'reminders',
      pageBuilder: (context, state) =>
          slidePage(state, const RemindersScreen()),
    ),
    GoRoute(
      path: '/integrations',
      name: 'integrations',
      pageBuilder: (context, state) =>
          slidePage(state, const IntegrationsScreen()),
    ),
    GoRoute(
      path: '/skills',
      name: 'skills',
      pageBuilder: (context, state) =>
          slidePage(state, const SkillsScreen()),
    ),
    GoRoute(
      path: '/ai-hub',
      name: 'ai-hub',
      pageBuilder: (context, state) =>
          slidePage(state, const AiHubScreen()),
    ),
    GoRoute(
      path: '/assistant/setup',
      name: 'assistant-setup',
      pageBuilder: (context, state) =>
          slidePage(state, const AssistantSetupScreen()),
    ),
    GoRoute(
      path: '/assistant/settings',
      name: 'assistant-settings',
      pageBuilder: (context, state) =>
          slidePage(state, const AssistantSettingsScreen()),
    ),
    GoRoute(
      path: '/admin',
      name: 'admin',
      pageBuilder: (context, state) =>
          slidePage(state, const AdminScreen()),
    ),
    GoRoute(
      path: '/token-usage',
      name: 'token-usage',
      pageBuilder: (context, state) =>
          slidePage(state, const TokenUsageScreen()),
    ),
    GoRoute(
      path: '/legal',
      name: 'legal',
      pageBuilder: (context, state) =>
          slidePage(state, const LegalScreen()),
    ),
    GoRoute(
      path: '/help',
      name: 'help',
      pageBuilder: (context, state) =>
          slidePage(state, const HelpScreen()),
    ),
    GoRoute(
      path: '/call',
      name: 'call',
      // Always push the call over everything (incl. the web split layout and
      // any open dialogs/sheets) on the root navigator so it is fullscreen.
      parentNavigatorKey: rootNavigatorKey,
      pageBuilder: (context, state) {
        final extra = state.extra as Map<String, dynamic>? ?? {};
        return slidePage(
          state,
          CallScreen(
            targetId: extra['targetId'] as String? ?? '',
            targetName: extra['targetName'] as String? ?? 'User',
            conversationId: extra['conversationId'] as String? ?? '',
            isCaller: extra['isCaller'] as bool? ?? false,
            isVideo: extra['isVideo'] as bool? ?? true,
            initialOfferSdp: extra['initialOfferSdp'] as String?,
          ),
        );
      },
    ),
    GoRoute(
      path: '/group-call',
      name: 'group-call',
      // Fullscreen over everything (incl. web split layout) on the root nav.
      parentNavigatorKey: rootNavigatorKey,
      pageBuilder: (context, state) =>
          slidePage(state, const GroupCallScreen()),
    ),
  ];
}
