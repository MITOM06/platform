import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../domain/auth_provider.dart';
import '../../utils/auth_error.dart';
import 'password_strength_indicator.dart';

/// Display name + password form of the invitation accept screen. Validation
/// matches the new-password rules (≥8 chars, upper/lower/digit/special).
/// [agreedToTerms] is owned by the parent screen because the same checkbox
/// gates the Google button too. On success the auth state flips to
/// authenticated and the router moves the user on — nothing to do here.
class AcceptInvitePasswordForm extends ConsumerStatefulWidget {
  final String token;
  final bool agreedToTerms;

  const AcceptInvitePasswordForm({
    super.key,
    required this.token,
    required this.agreedToTerms,
  });

  @override
  ConsumerState<AcceptInvitePasswordForm> createState() =>
      _AcceptInvitePasswordFormState();
}

class _AcceptInvitePasswordFormState
    extends ConsumerState<AcceptInvitePasswordForm> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isLoading = false;
  bool _obscure = true;
  String _passwordValue = '';

  @override
  void dispose() {
    _nameController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _submit() async {
    if (!widget.agreedToTerms) {
      _snack(context.l10n.valMustAgreeTerms);
      return;
    }
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      await ref.read(authNotifierProvider.notifier).acceptInvitation(
            widget.token,
            _nameController.text.trim(),
            _passwordController.text,
          );
      if (mounted) _snack(context.l10n.authMsgInvitationAccepted);
    } catch (e) {
      if (mounted) _snack(authErrorMessage(context, e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String? _validatePassword(String? v) {
    final l10n = context.l10n;
    if (v == null || v.isEmpty) return l10n.valPasswordRequired;
    if (v.length < 8) return l10n.valPasswordMin8;
    if (!v.contains(RegExp(r'[A-Z]'))) return l10n.valPasswordUppercase;
    if (!v.contains(RegExp(r'[a-z]'))) return l10n.valPasswordLowercase;
    if (!v.contains(RegExp(r'[0-9]'))) return l10n.valPasswordDigit;
    if (!v.contains(RegExp(r'[!@#$%^&*]'))) return l10n.valPasswordSpecial;
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PonTextField(
            controller: _nameController,
            labelText: l10n.fieldDisplayName,
            prefixIcon: Icons.badge_rounded,
            maxLength: 50,
            counterText: '',
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
            validator: (v) {
              if (v == null || v.trim().isEmpty) return l10n.valNameRequired;
              if (v.trim().length < 2) return l10n.valNameMin2;
              return null;
            },
          ),
          const SizedBox(height: 16),
          PonTextField(
            controller: _passwordController,
            labelText: l10n.fieldPassword,
            prefixIcon: Icons.lock_rounded,
            obscureText: _obscure,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
            onChanged: (v) => setState(() => _passwordValue = v),
            suffixIcon: IconButton(
              icon: Icon(
                _obscure
                    ? Icons.visibility_rounded
                    : Icons.visibility_off_rounded,
                color: AppTheme.mutedText(context),
              ),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
            validator: _validatePassword,
          ),
          PasswordStrengthIndicator(password: _passwordValue),
          const SizedBox(height: 16),
          PonTextField(
            controller: _confirmController,
            labelText: l10n.fieldConfirmPassword,
            prefixIcon: Icons.lock_outline_rounded,
            obscureText: _obscure,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _submit(),
            validator: (v) => v != _passwordController.text
                ? l10n.valPasswordMismatch
                : null,
          ),
          const SizedBox(height: 24),
          PonButton(
            onPressed: _submit,
            isLoading: _isLoading,
            child: Text(l10n.inviteSubmit),
          ),
        ],
      ),
    );
  }
}
