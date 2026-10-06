import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/auth_provider.dart';
import '../domain/auth_state.dart';
import 'widgets/mfa_backup_codes_step.dart';
import 'widgets/mfa_enroll_view.dart';
import 'widgets/mfa_verify_view.dart';

/// `/mfa` — second sign-in step of a privileged member (Owner / Admin —
/// contract 09), after a password login or a Google login-code exchange
/// answered `MFA_REQUIRED`. Mirror of web `/mfa`.
///
/// The router (`route_guard.dart`) makes this the only reachable route while
/// a challenge is pending and redirects away once the auth state moves on:
/// - [AuthMfaPending] + enrollment required → [MfaEnrollView]
/// - [AuthMfaPending] → [MfaVerifyView] (authenticator or backup code)
/// - [AuthMfaBackupCodes] → the one-time backup codes; acknowledging them
///   completes the enrollment and only then creates the session (contract 11)
class MfaScreen extends ConsumerWidget {
  const MfaScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authNotifierProvider).valueOrNull;
    return switch (auth) {
      // Keyed by token so a new sign-in attempt starts from a clean form.
      AuthMfaPending(:final challenge) when challenge.enrollmentRequired =>
        MfaEnrollView(key: ValueKey(challenge.mfaToken), challenge: challenge),
      AuthMfaPending(:final challenge) =>
        MfaVerifyView(key: ValueKey(challenge.mfaToken), challenge: challenge),
      AuthMfaBackupCodes(:final challenge, :final backupCodes) =>
        MfaBackupCodesStep(
          key: ValueKey('codes-${challenge.mfaToken}'),
          codes: backupCodes,
        ),
      // Signed in / out: the router is already leaving this page.
      _ => const Scaffold(body: Center(child: CircularProgressIndicator())),
    };
  }
}
