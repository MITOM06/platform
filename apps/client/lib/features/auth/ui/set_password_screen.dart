import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../domain/auth_provider.dart';
import '../domain/auth_state.dart';
import '../utils/auth_error.dart';
import '../utils/password_policy.dart';
import 'widgets/password_strength_indicator.dart';
import 'widgets/read_only_email_field.dart';

/// Forced onboarding step for a member who joined through a Google invitation
/// (`user.mustSetPassword`): create a PON password before using the app.
/// Mirror of web `/set-password`.
///
/// The router (`route_guard.dart`) makes this the only reachable route while
/// the flag is set, so there is deliberately no back/skip action — only
/// "Create password" and "Log out". On success the user is re-fetched (`/me`,
/// flag now false) and the router lets them continue home.
class SetPasswordScreen extends ConsumerStatefulWidget {
  const SetPasswordScreen({super.key});

  @override
  ConsumerState<SetPasswordScreen> createState() => _SetPasswordScreenState();
}

class _SetPasswordScreenState extends ConsumerState<SetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isLoading = false;
  String? _errorText;
  String _passwordValue = '';

  @override
  void initState() {
    super.initState();
    Future.microtask(_resyncUser);
  }

  /// The flag comes from the session cached on this device, which goes stale
  /// if the password was already created elsewhere (e.g. on web). Re-check
  /// `/me` once: when the server says the flag is cleared, the router leaves
  /// this screen by itself instead of trapping the member here.
  Future<void> _resyncUser() async {
    if (!mounted) return;
    try {
      await ref.read(authNotifierProvider.notifier).refreshUser();
    } catch (_) {
      // Offline / transient: keep the cached state — the form still works and
      // a 401 has already been turned into a logout by the Dio interceptor.
    }
  }

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_isLoading) return;
    setState(() => _errorText = null);
    if (_formKey.currentState?.validate() != true) return;
    setState(() => _isLoading = true);
    try {
      await ref
          .read(authNotifierProvider.notifier)
          .setInitialPassword(_passwordController.text);
      if (!mounted) return;
      showInfoSnackBar(context.l10n.setPasswordSuccess);
      // The router normally moves on by itself once the flag clears; going
      // home explicitly covers a missed refresh (the gate re-checks anyway).
      context.go('/');
    } catch (e) {
      // The account already has a password (created elsewhere while the
      // open-time re-check was offline): re-sync so the gate can open.
      if (authErrorCode(e) == 'CURRENT_PASSWORD_REQUIRED') await _resyncUser();
      if (mounted) setState(() => _errorText = authErrorMessage(context, e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Signing out is the only other way off this screen; the router sends the
  /// signed-out user to /login.
  Future<void> _signOut() async {
    setState(() => _isLoading = true);
    try {
      await ref.read(authNotifierProvider.notifier).logout();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;

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
                    l10n.setPasswordTitle,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: onSurface,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    l10n.setPasswordSubtitle,
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
                      child: _buildForm(context),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Center(
                    child: TextButton.icon(
                      key: const ValueKey('set-password-sign-out'),
                      onPressed: _isLoading ? null : _signOut,
                      icon: const Icon(Icons.logout_rounded, size: 18),
                      label: Text(l10n.actionLogout),
                      style: TextButton.styleFrom(
                        foregroundColor: AppTheme.mutedText(context),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    final l10n = context.l10n;
    final error = _errorText;
    final auth = ref.watch(authNotifierProvider).valueOrNull;
    final email = auth is AuthAuthenticated ? auth.user.email : '';
    final fieldStyle =
        TextStyle(color: Theme.of(context).colorScheme.onSurface);

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (error != null) ...[
            Text(
              error,
              key: const ValueKey('set-password-error'),
              style: TextStyle(
                color: Theme.of(context).colorScheme.error,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 12),
          ],
          // Which address to sign in with later (mirror of web).
          if (email.isNotEmpty) ...[
            ReadOnlyEmailField(email: email),
            const SizedBox(height: 16),
          ],
          PonTextField(
            key: const ValueKey('set-password-new'),
            controller: _passwordController,
            labelText: l10n.fieldNewPassword,
            prefixIcon: Icons.lock_rounded,
            obscureText: true,
            enableVisibilityToggle: true,
            style: fieldStyle,
            enabled: !_isLoading,
            autofillHints: const [AutofillHints.newPassword],
            onChanged: (v) => setState(() => _passwordValue = v),
            validator: (v) => newPasswordPolicyError(l10n, v),
          ),
          PasswordStrengthIndicator(password: _passwordValue),
          const SizedBox(height: 16),
          PonTextField(
            key: const ValueKey('set-password-confirm'),
            controller: _confirmController,
            labelText: l10n.fieldConfirmPassword,
            prefixIcon: Icons.lock_outline_rounded,
            obscureText: true,
            enableVisibilityToggle: true,
            style: fieldStyle,
            enabled: !_isLoading,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _submit(),
            validator: (v) => v != _passwordController.text
                ? l10n.valPasswordMismatch
                : null,
          ),
          const SizedBox(height: 24),
          PonButton(
            key: const ValueKey('set-password-submit'),
            onPressed: _submit,
            isLoading: _isLoading,
            child: Text(l10n.setPasswordSubmit),
          ),
        ],
      ),
    );
  }
}
