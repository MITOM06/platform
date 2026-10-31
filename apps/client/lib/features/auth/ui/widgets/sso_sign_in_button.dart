import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart' show launchUrl, LaunchMode;
import '../../../../core/config/app_config.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/sso_reauth_flag.dart';

/// "Sign in with SSO": opens the company IdP (`/auth/oidc/login`) in the
/// browser; the IdP redirect deep-links back through the existing
/// `platform://auth?code=…` handler. A pending invitation for the same email
/// is consumed by that SSO sign-in server-side.
///
/// After a sign-out on this device the IdP is asked to authenticate again
/// instead of silently re-entering that account ([SsoReauthFlag]).
///
/// [emphasised] renders it as the primary (filled) action — used when the
/// member must use SSO (`SSO_REQUIRED` notice, contract 13 §C) or when the
/// workspace enforces SSO for some domains.
class SsoSignInButton extends ConsumerWidget {
  final bool emphasised;
  const SsoSignInButton({super.key, this.emphasised = false});

  static const emphasisedKey = ValueKey('sso-sign-in-emphasised');
  static const plainKey = ValueKey('sso-sign-in');

  Future<void> _launch(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    final l10n = context.l10n;
    final reauth = ref.read(ssoReauthFlagProvider).isDue ? '&reauth=1' : '';
    // PON_DOMAIN-aware base, like every other auth call.
    final uri = Uri.parse(
        '${AppConfig.authBaseUrl}/auth/oidc/login?platform=mobile$reauth');
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.errCannotOpenLink)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final label = Text(context.l10n.loginWithSso);
    const icon = Icon(Icons.vpn_key_rounded, size: 18);
    final scheme = Theme.of(context).colorScheme;
    if (emphasised) {
      return FilledButton.icon(
        key: emphasisedKey,
        onPressed: () => _launch(context, ref),
        icon: icon,
        label: label,
        style: FilledButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusControl),
          ),
        ),
      );
    }
    return OutlinedButton.icon(
      key: plainKey,
      onPressed: () => _launch(context, ref),
      icon: icon,
      label: label,
      style: OutlinedButton.styleFrom(
        foregroundColor: scheme.onSurface,
        side: BorderSide(color: AppTheme.hairline(context)),
      ),
    );
  }
}
