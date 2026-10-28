import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart' show launchUrl, LaunchMode;
import '../../../core/config/app_config.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/google_logo_icon.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../domain/auth_provider.dart';
import '../domain/auth_state.dart';
import '../domain/invitation_preview.dart';
import '../domain/invitation_preview_provider.dart';
import '../domain/sso_info_provider.dart';
import '../utils/auth_error.dart';
import 'widgets/accept_invite_password_form.dart';
import 'widgets/auth_notice_box.dart';
import 'widgets/invite_status_view.dart';
import 'widgets/read_only_email_field.dart';
import 'widgets/sso_sign_in_button.dart';
import 'widgets/terms_agreement_row.dart';

/// `/invite/:token` — accept an admin invitation either with Google (the
/// Google account email must match the invited email; the existing
/// `platform://auth?code=` deep link finishes sign-in) or by choosing a
/// display name + password. Mirrors the web `/invite/[token]` page.
///
/// A password accept signs a Member in directly; an Owner / Admin-like invite
/// continues to the 2FA enrollment step (`/mfa`, contract 15).
///
/// When the invited email's domain must use SSO (contract 13 §C), accepting
/// with a password or Google answers `SSO_REQUIRED`: the card then says so and
/// offers "Sign in with SSO" instead — that sign-in consumes the invitation.
///
/// A Google attempt cancelled on Google's page or refused by Google comes back
/// as `platform://auth?error=SOCIAL_LOGIN_*`: the card shows it in place so the
/// member can try again (web returns to `/invite/<token>?reason=`).
class AcceptInviteScreen extends ConsumerStatefulWidget {
  final String token;

  const AcceptInviteScreen({super.key, required this.token});

  @override
  ConsumerState<AcceptInviteScreen> createState() => _AcceptInviteScreenState();
}

class _AcceptInviteScreenState extends ConsumerState<AcceptInviteScreen> {
  bool _agreedToTerms = false;

  /// The accept attempt was refused with `SSO_REQUIRED`.
  bool _ssoRequired = false;

  /// The last Google attempt was cancelled / refused ([kInviteRetryNotices]).
  String? _googleNotice;

  void _onSsoRequired() {
    if (mounted && !_ssoRequired) setState(() => _ssoRequired = true);
  }

  /// A Google accept that fails comes back as the deep link
  /// `platform://auth?error=CODE` while this screen is open (the notice lands
  /// on the auth state). Only a change seen here counts, so a stale reason
  /// from an earlier session never shows on a new invitation.
  void _listenForSignInNotice() {
    ref.listen<AsyncValue<AuthState>>(authNotifierProvider, (prev, next) {
      String? reasonOf(AsyncValue<AuthState>? v) {
        final s = v?.valueOrNull;
        return s is AuthUnauthenticated ? s.reason : null;
      }

      final reason = reasonOf(next);
      if (reason == kSsoRequired && reasonOf(prev) != kSsoRequired) {
        _onSsoRequired();
      } else if (kInviteRetryNotices.contains(reason) && mounted) {
        setState(() => _googleNotice = reason);
      }
    });
  }

  Future<void> _continueWithGoogle() async {
    final messenger = ScaffoldMessenger.of(context);
    final l10n = context.l10n;
    if (!_agreedToTerms) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.valMustAgreeTerms)));
      return;
    }
    setState(() => _googleNotice = null);
    final uri = Uri.parse(
      '${AppConfig.authBaseUrl}/auth/social/google/init'
      '?platform=mobile&invite=${Uri.encodeComponent(widget.token)}',
    );
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.errCannotOpenLink)));
    }
  }

  @override
  Widget build(BuildContext context) {
    _listenForSignInNotice();
    final async = ref.watch(invitationPreviewProvider(widget.token));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.go('/login'),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 450),
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: PonLogo(size: 80, showText: true)),
                  const SizedBox(height: 24),
                  async.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (e, _) => InviteStatusView(
                      code: authErrorCode(e),
                      fallbackMessage: authErrorMessage(context, e),
                      onRetry: () => ref.invalidate(
                          invitationPreviewProvider(widget.token)),
                    ),
                    data: (preview) => _buildAcceptCard(context, preview),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAcceptCard(BuildContext context, InvitationPreview preview) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return PonCard(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.inviteTitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: onSurface,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              preview.roleName != null
                  ? l10n.inviteSubtitle(
                      preview.inviterName,
                      preview.workspaceName,
                      preview.roleName!,
                    )
                  : l10n.inviteSubtitleNoRole(
                      preview.inviterName,
                      preview.workspaceName,
                    ),
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.mutedText(context)),
            ),
            const SizedBox(height: 20),
            if (_googleNotice != null && !_ssoRequired) ...[
              AuthNoticeBox(
                key: const ValueKey('invite-notice'),
                message: authCodeToString(context, _googleNotice!),
                icon: Icons.error_outline_rounded,
              ),
              const SizedBox(height: 16),
            ],
            ReadOnlyEmailField(email: preview.email),
            const SizedBox(height: 16),
            if (_ssoRequired)
              ..._ssoOptions(context)
            else
              ..._acceptOptions(context, preview),
          ],
        ),
      ),
    );
  }

  /// SSO-enforced domain: no password / Google accept — sign in with SSO.
  List<Widget> _ssoOptions(BuildContext context) => [
        AuthNoticeBox(
          key: const ValueKey('invite-sso-required'),
          message: context.l10n.inviteSsoRequired,
          icon: Icons.vpn_key_rounded,
          isError: false,
        ),
        const SizedBox(height: 16),
        const SsoSignInButton(emphasised: true),
      ];

  /// Terms + "Continue with Google" (unless the server has Google sign-in
  /// off) + display name / password form.
  List<Widget> _acceptOptions(BuildContext context, InvitationPreview preview) {
    final l10n = context.l10n;
    final muted = AppTheme.mutedText(context);
    final googleEnabled =
        ref.watch(ssoInfoProvider).valueOrNull?.googleEnabled ?? true;
    return [
      TermsAgreementRow(
        value: _agreedToTerms,
        onChanged: (v) => setState(() => _agreedToTerms = v),
      ),
      const SizedBox(height: 20),
      if (googleEnabled) ...[
        OutlinedButton.icon(
          onPressed: _continueWithGoogle,
          icon: const GoogleLogoIcon(size: 18),
          label: Text(l10n.inviteContinueWithGoogle),
          style: OutlinedButton.styleFrom(
            foregroundColor: Theme.of(context).colorScheme.onSurface,
            side: BorderSide(color: AppTheme.hairline(context)),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          l10n.inviteGoogleHint(preview.email),
          textAlign: TextAlign.center,
          style: TextStyle(color: muted, fontSize: 12),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(child: Divider(color: AppTheme.hairline(context))),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                l10n.inviteOrSetPassword,
                style: TextStyle(color: muted, fontSize: 12),
              ),
            ),
            Expanded(child: Divider(color: AppTheme.hairline(context))),
          ],
        ),
        const SizedBox(height: 16),
      ],
      AcceptInvitePasswordForm(
        token: widget.token,
        agreedToTerms: _agreedToTerms,
        onSsoRequired: _onSsoRequired,
      ),
    ];
  }
}
