import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/utils/app_error.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../../auth/data/auth_repository.dart';
import '../../../auth/ui/widgets/password_strength_indicator.dart';

void showChangePasswordDialog(BuildContext context, WidgetRef ref) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => _ChangePasswordDialogContent(isDark: isDark),
  );
}

class _ChangePasswordDialogContent extends ConsumerStatefulWidget {
  final bool isDark;
  const _ChangePasswordDialogContent({required this.isDark});

  @override
  ConsumerState<_ChangePasswordDialogContent> createState() =>
      __ChangePasswordDialogContentState();
}

class __ChangePasswordDialogContentState
    extends ConsumerState<_ChangePasswordDialogContent> {
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isLoading = false;
  String? _errorText;
  String _newPasswordValue = '';

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final currentPass = _currentPasswordController.text;
    final newPass = _newPasswordController.text;
    final confirmPass = _confirmPasswordController.text;

    // NOTE: current password is intentionally NOT required here. Social-login
    // (Google) accounts have no password yet and must be able to set
    // one for the first time. The server enforces the current-password check
    // only for accounts that already have a password.
    // Enforce the same strong-password requirements as the register screen.
    if (newPass.isEmpty) {
      setState(() => _errorText = context.l10n.valPasswordRequired);
      return;
    }
    if (newPass.length < 8) {
      setState(() => _errorText = context.l10n.valPasswordMin8);
      return;
    }
    if (!newPass.contains(RegExp(r'[A-Z]'))) {
      setState(() => _errorText = context.l10n.valPasswordUppercase);
      return;
    }
    if (!newPass.contains(RegExp(r'[a-z]'))) {
      setState(() => _errorText = context.l10n.valPasswordLowercase);
      return;
    }
    if (!newPass.contains(RegExp(r'[0-9]'))) {
      setState(() => _errorText = context.l10n.valPasswordDigit);
      return;
    }
    if (!newPass.contains(RegExp(r'[!@#$%^&*]'))) {
      setState(() => _errorText = context.l10n.valPasswordSpecial);
      return;
    }
    if (newPass != confirmPass) {
      setState(() => _errorText = context.l10n.valPasswordMismatch);
      return;
    }

    setState(() {
      _isLoading = true;
      _errorText = null;
    });

    try {
      await ref
          .read(authRepositoryProvider)
          .changePassword(currentPass, newPass);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.passwordChangedSuccess)),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorText = _mapError(e));
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  /// Maps the backend's English error strings to localized messages. The
  /// server returns 409 with a `message` field for each validation failure.
  String _mapError(Object e) {
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
    final activeColor = widget.isDark
        ? AppTheme.ponCyan
        : Theme.of(context).colorScheme.primary;

    return AlertDialog(
      backgroundColor: widget.isDark ? AppTheme.darkSurface : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: widget.isDark
              ? AppTheme.darkBorder.withValues(alpha: 0.5)
              : Colors.black.withValues(alpha: 0.08),
        ),
      ),
      title: Text(
        context.l10n.changePasswordTitle,
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: widget.isDark ? Colors.white : Colors.black87,
        ),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_errorText != null) ...[
              Text(
                _errorText!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 13),
              ),
              const SizedBox(height: 12),
            ],
            PonTextField(
              controller: _currentPasswordController,
              labelText: context.l10n.currentPassword,
              prefixIcon: Icons.lock_outline_rounded,
              obscureText: true,
              enableVisibilityToggle: true,
              style: TextStyle(color: widget.isDark ? Colors.white : Colors.black87),
              focusColor: activeColor,
              textInputAction: TextInputAction.next,
              enabled: !_isLoading,
              // Issue 4: never let OS/browser autofill prefill the current
              // password — the field must start empty (mirrors web's
              // autoComplete suppression).
              autofillHints: const [],
            ),
            const SizedBox(height: 12),
            PonTextField(
              controller: _newPasswordController,
              labelText: context.l10n.newPassword,
              prefixIcon: Icons.lock_open_rounded,
              obscureText: true,
              enableVisibilityToggle: true,
              style: TextStyle(color: widget.isDark ? Colors.white : Colors.black87),
              focusColor: activeColor,
              textInputAction: TextInputAction.next,
              enabled: !_isLoading,
              onChanged: (v) => setState(() => _newPasswordValue = v),
            ),
            PasswordStrengthIndicator(password: _newPasswordValue),
            const SizedBox(height: 12),
            PonTextField(
              controller: _confirmPasswordController,
              labelText: context.l10n.confirmPassword,
              prefixIcon: Icons.lock_rounded,
              obscureText: true,
              enableVisibilityToggle: true,
              style: TextStyle(color: widget.isDark ? Colors.white : Colors.black87),
              focusColor: activeColor,
              textInputAction: TextInputAction.done,
              enabled: !_isLoading,
              onFieldSubmitted: (_) => _submit(),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isLoading ? null : () => Navigator.pop(context),
          child: Text(
            context.l10n.actionCancel,
            style: TextStyle(
              color: widget.isDark
                  ? Colors.white.withValues(alpha: 0.6)
                  : Colors.black54,
            ),
          ),
        ),
        if (_isLoading)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.0),
            child: SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.ponCyan),
            ),
          )
        else
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: activeColor,
              foregroundColor: Colors.white,
            ),
            onPressed: _submit,
            child: Text(context.l10n.actionSave),
          ),
      ],
    );
  }
}
