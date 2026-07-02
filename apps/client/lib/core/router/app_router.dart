import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../features/auth/domain/auth_provider.dart';
import '../../features/auth/domain/auth_state.dart';
import '../../features/auth/ui/login_screen.dart';
import '../../features/auth/ui/register_screen.dart';
import '../../features/auth/ui/verify_otp_screen.dart';
import '../../features/auth/ui/forgot_password_screen.dart';
import '../../features/auth/ui/new_password_screen.dart';
import '../../features/auth/ui/theme_onboarding_screen.dart';
import '../../features/chat/ui/chat_screen.dart';
import '../../features/chat/ui/archived_chats_screen.dart';
import '../../features/chat/ui/blocked_conversations_screen.dart';
import '../../features/home/ui/responsive_home_layout.dart';
import '../utils/global_messenger.dart';
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
import '../../features/chat/ui/ai_memory_screen.dart';
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
import '../../../core/providers/theme_provider.dart';

part 'app_router.g.dart';

// ---------------------------------------------------------------------------
// RouterNotifier — bridges auth state changes into GoRouter refresh
// ---------------------------------------------------------------------------

@riverpod
class RouterNotifier extends _$RouterNotifier
    with ChangeNotifier
    implements Listenable {
  @override
  Future<bool> build() async {
    final authValue = ref.watch(authNotifierProvider);
    ref.watch(themeOnboardingNotifierProvider); // also listen to onboarding state
    // Notify GoRouter on a microtask to avoid "notifyListeners during build".
    // ChangeNotifier fans out to every registered listener, so a rebuild that
    // re-registers GoRouter's listener can no longer strand a stale/null slot
    // (the previous single-slot impl could, causing OAuth logins to not redirect).
    Future.microtask(notifyListeners);
    return authValue.valueOrNull is AuthAuthenticated;
  }
}

// ---------------------------------------------------------------------------
// GoRouter provider
// ---------------------------------------------------------------------------

final _publicRoutes = {
  '/login',
  '/register',
  '/verify-otp',
  '/forgot-password',
  '/new-password',
  '/legal', // public legal page — reachable from the register screen pre-login
};

@riverpod
GoRouter appRouter(AppRouterRef ref) {
  final notifier = ref.watch(routerNotifierProvider.notifier);

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/login',
    refreshListenable: notifier,
    redirect: (context, state) {
      final authValue = ref.read(authNotifierProvider);
      final onboardingCompleted = ref.read(themeOnboardingNotifierProvider);

      // Wait for session restore before redirecting
      if (authValue.isLoading) return null;

      final isAuth = authValue.valueOrNull is AuthAuthenticated;
      final onPublic = _publicRoutes.contains(state.uri.path);

      if (!isAuth && !onPublic) return '/login';
      
      if (isAuth) {
        if (!onboardingCompleted && state.uri.path != '/theme-onboarding') {
          return '/theme-onboarding';
        }
        
        if (onboardingCompleted && state.uri.path == '/theme-onboarding') {
          return '/';
        }

        if (onPublic) return '/';
      }
      return null;
    },
    routes: [
      // ── Public ──────────────────────────────────────────────────────────
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        name: 'register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/verify-otp',
        name: 'verify-otp',
        builder: (context, state) {
          final email =
              Uri.decodeComponent(state.uri.queryParameters['email'] ?? '');
          final isForgotPassword =
              state.uri.queryParameters['isForgotPassword'] == 'true';
          return VerifyOtpScreen(email: email, isForgotPassword: isForgotPassword);
        },
      ),
      GoRoute(
        path: '/forgot-password',
        name: 'forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/new-password',
        name: 'new-password',
        builder: (context, state) {
          final email =
              Uri.decodeComponent(state.uri.queryParameters['email'] ?? '');
          final otpParam = state.uri.queryParameters['otp'];
          final otp = otpParam != null ? Uri.decodeComponent(otpParam) : null;
          return NewPasswordScreen(email: email, otp: otp);
        },
      ),

      // ── Protected ───────────────────────────────────────────────────────
      GoRoute(
        path: '/theme-onboarding',
        name: 'theme-onboarding',
        builder: (context, state) => const ThemeOnboardingScreen(),
      ),
      GoRoute(
        path: '/',
        name: 'conversations',
        builder: (context, state) => const ResponsiveHomeLayout(),
        routes: [
          GoRoute(
            path: 'chat/:id',
            name: 'chat',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return ChatScreen(conversationId: id);
            },
          ),
        ],
      ),
      GoRoute(
        path: '/archived',
        name: 'archived',
        builder: (context, state) => const ArchivedChatsScreen(),
      ),
      GoRoute(
        path: '/blocked',
        name: 'blocked',
        builder: (context, state) => const BlockedConversationsScreen(),
      ),
      GoRoute(
        path: '/settings',
        name: 'settings',
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/settings/security',
        name: 'settings-security',
        builder: (context, state) => const SecuritySettingsScreen(),
      ),
      GoRoute(
        path: '/new-conversation',
        name: 'new-conversation',
        builder: (context, state) => const NewConversationScreen(),
      ),
      GoRoute(
        path: '/new-group',
        name: 'new-group',
        builder: (context, state) => const NewGroupScreen(),
      ),
      GoRoute(
        path: '/user/:id',
        name: 'user-profile',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          final convId = state.uri.queryParameters['conversationId'];
          return UserProfileScreen(userId: id, conversationId: convId);
        },
      ),
      GoRoute(
        path: '/edit-profile',
        name: 'edit-profile',
        builder: (context, state) => const EditProfileScreen(),
      ),
      GoRoute(
        path: '/friends',
        name: 'friends',
        builder: (context, state) => const FriendsScreen(),
      ),
      GoRoute(
        path: '/group-info/:id',
        name: 'group-info',
        builder: (context, state) =>
            GroupInfoScreen(conversationId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/explore',
        name: 'explore',
        builder: (context, state) => const ExploreScreen(),
      ),
      GoRoute(
        path: '/shared-media/:conversationId',
        name: 'shared-media',
        builder: (context, state) => ExploreMediaScreen(
          conversationId: state.pathParameters['conversationId']!,
        ),
      ),
      GoRoute(
        path: '/ai-memories',
        name: 'ai-memories',
        builder: (context, state) => const AiMemoryScreen(),
      ),
      GoRoute(
        path: '/ai-persona/:conversationId',
        name: 'ai-persona',
        builder: (context, state) => AiPersonaScreen(
          conversationId: state.pathParameters['conversationId']!,
        ),
      ),
      GoRoute(
        path: '/kb/:conversationId',
        name: 'kb',
        builder: (context, state) => KbScreen(
          conversationId: state.pathParameters['conversationId']!,
        ),
      ),
      GoRoute(
        path: '/reminders',
        name: 'reminders',
        builder: (context, state) => const RemindersScreen(),
      ),
      GoRoute(
        path: '/integrations',
        name: 'integrations',
        builder: (context, state) => const IntegrationsScreen(),
      ),
      GoRoute(
        path: '/skills',
        name: 'skills',
        builder: (context, state) => const SkillsScreen(),
      ),
      GoRoute(
        path: '/ai-hub',
        name: 'ai-hub',
        builder: (context, state) => const AiHubScreen(),
      ),
      GoRoute(
        path: '/assistant/setup',
        name: 'assistant-setup',
        builder: (context, state) => const AssistantSetupScreen(),
      ),
      GoRoute(
        path: '/assistant/settings',
        name: 'assistant-settings',
        builder: (context, state) => const AssistantSettingsScreen(),
      ),
      GoRoute(
        path: '/admin',
        name: 'admin',
        builder: (context, state) => const AdminScreen(),
      ),
      GoRoute(
        path: '/token-usage',
        name: 'token-usage',
        builder: (context, state) => const TokenUsageScreen(),
      ),
      GoRoute(
        path: '/legal',
        name: 'legal',
        builder: (context, state) => const LegalScreen(),
      ),
      GoRoute(
        path: '/help',
        name: 'help',
        builder: (context, state) => const HelpScreen(),
      ),
      GoRoute(
        path: '/call',
        name: 'call',
        // Always push the call over everything (incl. the web split layout and
        // any open dialogs/sheets) on the root navigator so it is fullscreen.
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return CallScreen(
            targetId: extra['targetId'] as String? ?? '',
            targetName: extra['targetName'] as String? ?? 'User',
            conversationId: extra['conversationId'] as String? ?? '',
            isCaller: extra['isCaller'] as bool? ?? false,
            isVideo: extra['isVideo'] as bool? ?? true,
            initialOfferSdp: extra['initialOfferSdp'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/group-call',
        name: 'group-call',
        // Fullscreen over everything (incl. web split layout) on the root nav.
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const GroupCallScreen(),
      ),
    ],
  );
}
