import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../domain/auth_provider.dart';

/// Shared layout of the `/mfa` steps (same frame as the other auth screens):
/// logo, title, subtitle, the step's card and an optional footer. No AppBar:
/// the only way out of a pending challenge is [MfaBackToSignIn].
class MfaFrame extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget child;
  final Widget? footer;

  const MfaFrame({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
    this.footer,
  });

  @override
  Widget build(BuildContext context) {
    final footer = this.footer;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 450),
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: PonLogo(size: 88, showText: true)),
                  const SizedBox(height: 16),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    subtitle,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppTheme.mutedText(context),
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 24),
                  PonCard(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: child,
                    ),
                  ),
                  if (footer != null) ...[
                    const SizedBox(height: 16),
                    Center(child: footer),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// "Back to sign in": drops the pending challenge; the router then leaves
/// `/mfa` for `/login` (no session exists yet, nothing to sign out of).
class MfaBackToSignIn extends ConsumerWidget {
  final bool enabled;
  const MfaBackToSignIn({super.key, this.enabled = true});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return TextButton.icon(
      key: const ValueKey('mfa-back-to-sign-in'),
      onPressed: enabled
          ? () => ref.read(authNotifierProvider.notifier).cancelMfa()
          : null,
      icon: const Icon(Icons.arrow_back_rounded, size: 18),
      label: Text(context.l10n.mfaBackToSignIn),
      style: TextButton.styleFrom(foregroundColor: AppTheme.mutedText(context)),
    );
  }
}

/// Inline, localized error line used by every MFA form.
class MfaErrorText extends StatelessWidget {
  final String? message;
  const MfaErrorText(this.message, {super.key});

  @override
  Widget build(BuildContext context) {
    final message = this.message;
    if (message == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        message,
        key: const ValueKey('mfa-error'),
        style: TextStyle(
          color: Theme.of(context).colorScheme.error,
          fontSize: 14,
        ),
      ),
    );
  }
}

/// One numbered instruction line of an enrollment ("1. Install …"). Shared by
/// `/mfa` enroll mode and "Turn on 2FA" in Settings → Security.
class MfaStepText extends StatelessWidget {
  final String text;
  const MfaStepText(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        text,
        style: TextStyle(
          color: Theme.of(context).colorScheme.onSurface,
          fontSize: 14,
          height: 1.4,
        ),
      ),
    );
  }
}
