import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/auth_provider.dart';
import '../../domain/auth_state.dart';
import '../../utils/auth_error.dart';
import 'auth_notice_box.dart';

/// Explains a forced logout / refused sign-in on the login screen (e.g. "This
/// account has been blocked…", "Your organization requires single sign-on…").
/// Renders nothing for a normal logout. Mirror of the web login page's
/// `?reason=` alert. The reason is an allow-listed code ([kLoginNotices])
/// mapped to a localized string — never raw server text.
class LogoutReasonBanner extends ConsumerWidget {
  const LogoutReasonBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authNotifierProvider).valueOrNull;
    final reason = auth is AuthUnauthenticated ? auth.reason : null;
    if (reason == null) return const SizedBox.shrink();
    // SSO_REQUIRED is guidance (use the SSO button below), not a failure.
    final isSso = reason == kSsoRequired;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: AuthNoticeBox(
        key: const ValueKey('logout-reason'),
        message: authCodeToString(context, reason),
        isError: !isSso,
        icon: switch (reason) {
          'ACCOUNT_BLOCKED' => Icons.block_rounded,
          kSsoRequired => Icons.vpn_key_rounded,
          _ => Icons.error_outline_rounded,
        },
      ),
    );
  }
}
