import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/auth_provider.dart';
import '../../domain/auth_state.dart';
import '../../utils/auth_error.dart';

/// Explains a forced logout on the login screen (e.g. "This account has been
/// blocked…"). Renders nothing for a normal logout. Mirror of the web login
/// page's `?reason=` alert. The reason is an allow-listed code
/// ([kLogoutReasons]) mapped to a localized string — never raw server text.
class LogoutReasonBanner extends ConsumerWidget {
  const LogoutReasonBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authNotifierProvider).valueOrNull;
    final reason = auth is AuthUnauthenticated ? auth.reason : null;
    if (reason == null) return const SizedBox.shrink();
    final error = Theme.of(context).colorScheme.error;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Container(
        key: const ValueKey('logout-reason'),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: error.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: error.withValues(alpha: 0.4)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              reason == 'ACCOUNT_BLOCKED'
                  ? Icons.block_rounded
                  : Icons.error_outline_rounded,
              size: 18,
              color: error,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                authCodeToString(context, reason),
                style: TextStyle(color: error, fontSize: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
