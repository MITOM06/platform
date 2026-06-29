import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../auth/ui/widgets/password_strength_indicator.dart';

/// Dedicated "Password & Security" screen (mirror of web `/settings/security`).
///
/// - Amber warning card when the account has no local password (OAuth-only).
/// - Password form: 2 fields (new + confirm) when no password exists yet,
///   3 fields (current + new + confirm) when changing an existing one.
/// - 2FA placeholder ListTile (disabled / "Coming soon").
class SecuritySettingsScreen extends ConsumerWidget {
  const SecuritySettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authAsync = ref.watch(authNotifierProvider);
    final user = authAsync.valueOrNull is AuthAuthenticated
        ? (authAsync.value! as AuthAuthenticated).user
        : null;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.securityTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                if (!user.hasPassword) ...[
                  _NoPasswordBanner(isDark: isDark),
                  const SizedBox(height: 24),
                ],
                _PasswordForm(hasPassword: user.hasPassword, isDark: isDark),
                const SizedBox(height: 24),
                _TwoFaPlaceholder(isDark: isDark),
              ],
            ),
    );
  }
}

/// Amber warning shown for OAuth-only accounts with no local password.
class _NoPasswordBanner extends StatelessWidget {
  final bool isDark;
  const _NoPasswordBanner({required this.isDark});

  @override
  Widget build(BuildContext context) {
    const amber = Color(0xFFF59E0B);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: amber.withValues(alpha: isDark ? 0.12 : 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: amber.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded, color: amber, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.l10n.securityNoPasswordTitle,
                  style: const TextStyle(
                    color: amber,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  context.l10n.securityNoPasswordSubtitle,
                  style: TextStyle(
                    color: amber.withValues(alpha: 0.85),
                    fontSize: 12.5,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The password set/change form. Stateful: holds controllers + submit state.
class _PasswordForm extends ConsumerStatefulWidget {
  final bool hasPassword;
  final bool isDark;
  const _PasswordForm({required this.hasPassword, required this.isDark});

  @override
  ConsumerState<_PasswordForm> createState() => _PasswordFormState();
}

class _PasswordFormState extends ConsumerState<_PasswordForm> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isLoading = false;
  String? _errorText;
  String _newPasswordValue = '';

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  /// Validates the new password against the same rules as the register screen.
  String? _validate(BuildContext context, String newPass, String confirm) {
    final l10n = context.l10n;
    if (newPass.isEmpty) return l10n.valPasswordRequired;
    if (newPass.length < 8) return l10n.valPasswordMin8;
    if (!newPass.contains(RegExp(r'[A-Z]'))) return l10n.valPasswordUppercase;
    if (!newPass.contains(RegExp(r'[a-z]'))) return l10n.valPasswordLowercase;
    if (!newPass.contains(RegExp(r'[0-9]'))) return l10n.valPasswordDigit;
    if (!newPass.contains(RegExp(r'[!@#$%^&*]'))) {
      return l10n.valPasswordSpecial;
    }
    if (newPass != confirm) return l10n.valPasswordMismatch;
    return null;
  }

  Future<void> _submit() async {
    final current = _currentController.text;
    final newPass = _newController.text;
    final confirm = _confirmController.text;

    final validationError = _validate(context, newPass, confirm);
    if (validationError != null) {
      setState(() => _errorText = validationError);
      return;
    }

    setState(() {
      _isLoading = true;
      _errorText = null;
    });

    try {
      // For first-time setup there is no current password; the server only
      // enforces the current-password check for accounts that already have one.
      await ref
          .read(authRepositoryProvider)
          .changePassword(widget.hasPassword ? current : '', newPass);
      // Re-fetch the user so `hasPassword` flips and the UI updates.
      await ref.read(authNotifierProvider.notifier).refreshUser();
      if (!mounted) return;
      showInfoSnackBar(
        widget.hasPassword
            ? context.l10n.passwordChangedSuccess
            : context.l10n.securitySetSuccess,
      );
      _currentController.clear();
      _newController.clear();
      _confirmController.clear();
      setState(() => _newPasswordValue = '');
    } catch (e) {
      if (mounted) setState(() => _errorText = _mapError(context, e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Maps the backend's English error strings to localized messages.
  String _mapError(BuildContext context, Object e) {
    final l10n = context.l10n;
    String message = '';
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['message'] is String) {
        message = data['message'] as String;
      }
    }
    if (message.contains('Incorrect current password')) {
      return l10n.errCurrentPasswordIncorrect;
    }
    if (message.contains('Current password is required')) {
      return l10n.valPasswordRequired;
    }
    if (message.contains('at least 6')) {
      return l10n.valPasswordMin6;
    }
    return friendlyError(e);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDark;
    final accent =
        isDark ? AppTheme.ponCyan : Theme.of(context).colorScheme.primary;

    return PonCard(
      glowColor: AppTheme.ponPink,
      glowStrength: isDark ? 4 : 0,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.vpn_key_outlined, color: accent, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.hasPassword
                            ? context.l10n.securityChangePasswordTitle
                            : context.l10n.securitySetPasswordTitle,
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.hasPassword
                            ? context.l10n.securityChangePasswordSubtitle
                            : context.l10n.securitySetPasswordSubtitle,
                        style: TextStyle(
                          color: isDark ? Colors.white54 : Colors.black54,
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (_errorText != null) ...[
              Text(
                _errorText!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 13),
              ),
              const SizedBox(height: 12),
            ],
            if (widget.hasPassword) ...[
              PonTextField(
                controller: _currentController,
                labelText: context.l10n.currentPassword,
                prefixIcon: Icons.lock_outline_rounded,
                obscureText: true,
                enableVisibilityToggle: true,
                style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                focusColor: accent,
                textInputAction: TextInputAction.next,
                enabled: !_isLoading,
                // Never let OS autofill prefill the current password.
                autofillHints: const [],
              ),
              const SizedBox(height: 12),
            ],
            PonTextField(
              controller: _newController,
              labelText: context.l10n.newPassword,
              prefixIcon: Icons.lock_open_rounded,
              obscureText: true,
              enableVisibilityToggle: true,
              style: TextStyle(color: isDark ? Colors.white : Colors.black87),
              focusColor: accent,
              textInputAction: TextInputAction.next,
              enabled: !_isLoading,
              onChanged: (v) => setState(() => _newPasswordValue = v),
            ),
            PasswordStrengthIndicator(password: _newPasswordValue),
            const SizedBox(height: 12),
            PonTextField(
              controller: _confirmController,
              labelText: context.l10n.confirmPassword,
              prefixIcon: Icons.lock_rounded,
              obscureText: true,
              enableVisibilityToggle: true,
              style: TextStyle(color: isDark ? Colors.white : Colors.black87),
              focusColor: accent,
              textInputAction: TextInputAction.done,
              enabled: !_isLoading,
              onFieldSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 20),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: accent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: _isLoading ? null : _submit,
              child: _isLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text(
                      widget.hasPassword
                          ? context.l10n.securityChangeButton
                          : context.l10n.securitySetButton,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Disabled / "Coming soon" two-factor authentication section.
class _TwoFaPlaceholder extends StatelessWidget {
  final bool isDark;
  const _TwoFaPlaceholder({required this.isDark});

  @override
  Widget build(BuildContext context) {
    final muted = isDark ? Colors.white54 : Colors.black54;
    return PonCard(
      glowColor: AppTheme.ponPeach,
      glowStrength: 0,
      child: Opacity(
        opacity: 0.7,
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          enabled: false,
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: muted.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.shield_outlined, color: muted, size: 20),
          ),
          title: Text(
            context.l10n.securityTwoFaTitle,
            style: TextStyle(
              color: muted,
              fontWeight: FontWeight.bold,
              fontSize: 15,
            ),
          ),
          subtitle: Text(
            context.l10n.securityTwoFaComingSoon,
            style: TextStyle(color: muted, fontSize: 12.5),
          ),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: muted.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              context.l10n.securityComingSoon,
              style: TextStyle(
                color: muted,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
