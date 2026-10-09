import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../domain/two_factor_settings_provider.dart';
import '../../utils/two_factor_error.dart';
import 'regenerate_backup_codes_dialog.dart';
import 'turn_off_two_factor_dialog.dart';
import 'two_factor_setup_steps.dart';

/// Settings → Security "Two-factor authentication" (contract 15). Shown when
/// the member can use 2FA at all (`user.mfaAvailable` — not for a member of
/// an SSO-enforced domain, whose IdP does MFA):
/// - required by the role (`mfaRequired` — Owner / Admin-like): the status
///   and, once enrolled, "Regenerate backup codes". No way to turn it off.
/// - optional (Member) and off: what it is + "Turn on 2FA" → in-place setup
///   (QR / key → first code → backup codes once) → status On. No session
///   change.
/// - optional and on: the status, "Regenerate backup codes" and "Turn off
///   2FA" (asks for a current code or a backup code).
///
/// Re-syncs `/me` once when shown: the cached session may predate the 2FA
/// flags (or a role change), and they only come from `/api/users/me`.
class TwoFactorSection extends ConsumerStatefulWidget {
  const TwoFactorSection({super.key});

  @override
  ConsumerState<TwoFactorSection> createState() => _TwoFactorSectionState();
}

class _TwoFactorSectionState extends ConsumerState<TwoFactorSection> {
  @override
  void initState() {
    super.initState();
    Future.microtask(_resync);
  }

  Future<void> _resync() async {
    if (!mounted) return;
    try {
      await ref.read(authNotifierProvider.notifier).refreshUser();
    } catch (_) {
      // Offline / transient: keep the cached flags (a 401 has already been
      // turned into a logout by the Dio interceptor).
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authNotifierProvider).valueOrNull;
    final user = auth is AuthAuthenticated ? auth.user : null;
    if (user == null || !user.mfaAvailable) return const SizedBox.shrink();
    final setup = ref.watch(twoFactorSettingsProvider);

    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent =
        isDark ? AppTheme.ponAccent : Theme.of(context).colorScheme.primary;
    final muted = AppTheme.mutedText(context);
    final enabled = user.mfaEnabled;
    final isRequired = user.mfaRequired;

    final String status;
    if (enabled) {
      status = l10n.securityMfaOn;
    } else {
      status =
          isRequired ? l10n.securityMfaPending : l10n.securityMfaOptionalHint;
    }
    final String pill;
    if (enabled) {
      pill = l10n.securityMfaStatusOn;
    } else {
      pill = isRequired
          ? l10n.securityMfaStatusOff
          : l10n.securityMfaStatusDisabled;
    }

    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: PonCard(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Header(
                status: status,
                pill: pill,
                accent: accent,
                pillColor: enabled ? accent : muted,
              ),
              _body(user, setup, accent),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(
    UserModel user,
    AsyncValue<TwoFactorSetupStep> setup,
    Color accent,
  ) {
    // The one-time backup codes stay until Done, although 2FA (and so the
    // status above) is already on.
    final step = setup.valueOrNull;
    if (step is TwoFactorSetupCodes) return TwoFactorCodesStep(codes: step.codes);

    if (user.mfaRequired) {
      return user.mfaEnabled ? const _Actions() : const SizedBox.shrink();
    }
    if (user.mfaEnabled) return const _Actions(canTurnOff: true);

    return setup.when(
      loading: () => _TurnOnPrompt(accent: accent, isLoading: true),
      error: (e, _) => _TurnOnPrompt(
        accent: accent,
        errorText: twoFactorErrorMessage(context, e),
      ),
      data: (step) => switch (step) {
        TwoFactorSetupScan(:final enrollment) =>
          TwoFactorScanStep(enrollment: enrollment),
        TwoFactorSetupCodes(:final codes) => TwoFactorCodesStep(codes: codes),
        TwoFactorSetupIdle() => _TurnOnPrompt(accent: accent),
      },
    );
  }
}

/// Shield icon, title, status line and the status pill.
class _Header extends StatelessWidget {
  final String status;
  final String pill;
  final Color accent;
  final Color pillColor;

  const _Header({
    required this.status,
    required this.pill,
    required this.accent,
    required this.pillColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.shield_rounded, color: accent, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.l10n.securityTwoFaTitle,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                status,
                key: const ValueKey('security-mfa-status'),
                style: TextStyle(
                  color: AppTheme.mutedText(context),
                  fontSize: 12.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        _StatusPill(label: pill, color: pillColor),
      ],
    );
  }
}

/// Enrolled: "Regenerate backup codes", plus "Turn off 2FA" when 2FA is
/// optional for the role ([canTurnOff]).
class _Actions extends StatelessWidget {
  final bool canTurnOff;
  const _Actions({this.canTurnOff = false});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final hairline = BorderSide(color: AppTheme.hairline(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 16),
        OutlinedButton.icon(
          key: const ValueKey('security-mfa-regenerate'),
          onPressed: () => RegenerateBackupCodesDialog.show(context),
          icon: const Icon(Icons.refresh_rounded, size: 18),
          label: Text(l10n.securityMfaRegenerate),
          style: OutlinedButton.styleFrom(
            foregroundColor: onSurface,
            side: hairline,
          ),
        ),
        if (canTurnOff) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            key: const ValueKey('security-mfa-turn-off'),
            onPressed: () => TurnOffTwoFactorDialog.show(context),
            icon: const Icon(Icons.remove_moderator_outlined, size: 18),
            label: Text(l10n.securityMfaTurnOff),
            style: OutlinedButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
              side: hairline,
            ),
          ),
        ],
      ],
    );
  }
}

/// Optional and off: "Turn on 2FA" (the explanation is the status line), with
/// the localized reason the last attempt stopped, if any.
class _TurnOnPrompt extends ConsumerWidget {
  final Color accent;
  final bool isLoading;
  final String? errorText;

  const _TurnOnPrompt({
    required this.accent,
    this.isLoading = false,
    this.errorText,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final errorText = this.errorText;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (errorText != null) ...[
          const SizedBox(height: 12),
          Text(
            errorText,
            key: const ValueKey('security-mfa-setup-error'),
            style: TextStyle(
              color: Theme.of(context).colorScheme.error,
              fontSize: 13,
            ),
          ),
        ],
        const SizedBox(height: 16),
        FilledButton.icon(
          key: const ValueKey('security-mfa-turn-on'),
          style: FilledButton.styleFrom(
            backgroundColor: accent,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          onPressed: isLoading
              ? null
              : () => ref.read(twoFactorSettingsProvider.notifier).start(),
          icon: isLoading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.verified_user_rounded, size: 18),
          label: Text(context.l10n.securityMfaTurnOn),
        ),
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusPill({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
