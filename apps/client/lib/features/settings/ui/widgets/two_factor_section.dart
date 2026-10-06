import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import 'regenerate_backup_codes_dialog.dart';

/// Settings → Security "Two-factor authentication" (contract 09). Only for a
/// member whose role requires it (`user.mfaRequired`) — everyone else is not
/// offered 2FA, so nothing renders. Shows the status and, once enrolled,
/// "Regenerate backup codes". There is deliberately no "disable" option.
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
    if (user == null || !user.mfaRequired) return const SizedBox.shrink();

    final l10n = context.l10n;
    final accent = AppTheme.accent(context);
    final muted = AppTheme.mutedText(context);
    final enabled = user.mfaEnabled;

    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: PonCard(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
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
                          l10n.securityTwoFaTitle,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          enabled ? l10n.securityMfaOn : l10n.securityMfaPending,
                          key: const ValueKey('security-mfa-status'),
                          style: TextStyle(color: muted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _StatusPill(
                    label: enabled
                        ? l10n.securityMfaStatusOn
                        : l10n.securityMfaStatusOff,
                    color: enabled ? accent : muted,
                  ),
                ],
              ),
              if (enabled) ...[
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  key: const ValueKey('security-mfa-regenerate'),
                  onPressed: () => RegenerateBackupCodesDialog.show(context),
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: Text(l10n.securityMfaRegenerate),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.onSurface,
                    side: BorderSide(color: AppTheme.hairline(context)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
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
