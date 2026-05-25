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
import '../../features/chat/ui/conversation_list_screen.dart';
import '../../features/chat/ui/chat_screen.dart';
import '../../features/chat/ui/new_conversation_screen.dart';
import '../../features/settings/ui/settings_screen.dart';

part 'app_router.g.dart';

// ---------------------------------------------------------------------------
// RouterNotifier — bridges auth state changes into GoRouter refresh
// ---------------------------------------------------------------------------

@riverpod
class RouterNotifier extends _$RouterNotifier implements Listenable {
  VoidCallback? _listener;

  @override
  Future<bool> build() async {
    final authValue = ref.watch(authNotifierProvider);
    _listener?.call();
    return authValue.valueOrNull is AuthAuthenticated;
  }

  @override
  void addListener(VoidCallback listener) => _listener = listener;

  @override
  void removeListener(VoidCallback listener) {
    if (_listener == listener) _listener = null;
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
};

@riverpod
GoRouter appRouter(AppRouterRef ref) {
  final notifier = ref.watch(routerNotifierProvider.notifier);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: notifier,
    redirect: (context, state) {
      final authValue = ref.read(authNotifierProvider);

      // Wait for session restore before redirecting
      if (authValue.isLoading) return null;

      final isAuth = authValue.valueOrNull is AuthAuthenticated;
      final onPublic = _publicRoutes.contains(state.uri.path);

      if (!isAuth && !onPublic) return '/login';
      if (isAuth && onPublic) return '/';
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
          return VerifyOtpScreen(email: email);
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
          return NewPasswordScreen(email: email);
        },
      ),

      // ── Protected ───────────────────────────────────────────────────────
      GoRoute(
        path: '/',
        name: 'conversations',
        builder: (context, state) => const ConversationListScreen(),
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
        path: '/settings',
        name: 'settings',
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/new-conversation',
        name: 'new-conversation',
        builder: (context, state) => const NewConversationScreen(),
      ),
    ],
  );
}
