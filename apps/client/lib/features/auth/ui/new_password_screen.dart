import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../data/auth_repository.dart';
import '../utils/auth_error.dart';
import 'widgets/password_strength_indicator.dart';

class NewPasswordScreen extends ConsumerStatefulWidget {
  final String email;
  /// Pre-filled OTP from the verify-otp screen (forgot password flow).
  /// When set, the OTP text field is hidden and this value is used directly.
  final String? otp;

  const NewPasswordScreen({super.key, required this.email, this.otp});

  @override
  ConsumerState<NewPasswordScreen> createState() => _NewPasswordScreenState();
}

class _NewPasswordScreenState extends ConsumerState<NewPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  String _newPasswordValue = '';

  @override
  void initState() {
    super.initState();
    if (widget.otp != null) {
      _otpController.text = widget.otp!;
    }
  }

  @override
  void dispose() {
    _otpController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      await ref.read(authRepositoryProvider).resetPassword(
            widget.email,
            _otpController.text.trim(),
            _passwordController.text,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.l10n.resetPasswordSuccess)));
        context.go('/login');
      }
    } on DioException catch (e) {
      if (mounted) {
        final msg = authErrorToString(context, e);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.l10n.errResetFailed)));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasPrefilledOtp = widget.otp != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.newPasswordTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.go('/forgot-password'),
        ),
      ),
      body: Stack(
        children: [
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.ponCyan.withValues(alpha: 0.12),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -120,
            right: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.ponPink.withValues(alpha: 0.15),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // Content
          SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 450),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Center(child: PonLogo(size: 100, showText: true)),
                      const SizedBox(height: 16),
                      Text(
                        context.l10n.newPasswordHeading,
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        context.l10n.newPasswordSubtitle(widget.email),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Reset Form Card
                      PonCard(
                        glowColor: AppTheme.ponPink,
                        glowStrength: 8,
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Form(
                            key: _formKey,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                // OTP field — hidden when pre-filled from verify-otp screen
                                if (!hasPrefilledOtp) ...[
                                  PonTextField(
                                    controller: _otpController,
                                    labelText: context.l10n.fieldOtp,
                                    prefixIcon: Icons.pin_outlined,
                                    keyboardType: TextInputType.number,
                                    maxLength: 6,
                                    counterText: '',
                                    style: const TextStyle(
                                      fontSize: 20,
                                      letterSpacing: 6,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                    textInputAction: TextInputAction.next,
                                    focusColor: AppTheme.ponCyan,
                                    validator: (v) {
                                      if (v == null || v.length != 6) return context.l10n.valOtp6;
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 16),
                                ],

                                // New Password
                                PonTextField(
                                  controller: _passwordController,
                                  labelText: context.l10n.fieldNewPassword,
                                  prefixIcon: Icons.lock_outlined,
                                  obscureText: _obscurePassword,
                                  focusColor: AppTheme.ponPink,
                                  onChanged: (v) =>
                                      setState(() => _newPasswordValue = v),
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      _obscurePassword
                                          ? Icons.visibility_outlined
                                          : Icons.visibility_off_outlined,
                                      color: Colors.white.withValues(alpha: 0.5),
                                    ),
                                    onPressed: () =>
                                        setState(() => _obscurePassword = !_obscurePassword),
                                  ),
                                  validator: (v) {
                                    // Match the registration password policy so a
                                    // reset can't set a weaker password than signup.
                                    if (v == null || v.isEmpty) return context.l10n.valNewPasswordRequired;
                                    if (v.length < 8) return context.l10n.valPasswordMin8;
                                    if (!v.contains(RegExp(r'[A-Z]'))) return context.l10n.valPasswordUppercase;
                                    if (!v.contains(RegExp(r'[a-z]'))) return context.l10n.valPasswordLowercase;
                                    if (!v.contains(RegExp(r'[0-9]'))) return context.l10n.valPasswordDigit;
                                    if (!v.contains(RegExp(r'[!@#$%^&*]'))) return context.l10n.valPasswordSpecial;
                                    return null;
                                  },
                                ),
                                PasswordStrengthIndicator(
                                    password: _newPasswordValue),
                                const SizedBox(height: 16),

                                // Confirm Password
                                PonTextField(
                                  controller: _confirmController,
                                  labelText: context.l10n.fieldConfirmPassword,
                                  prefixIcon: Icons.lock_outline,
                                  obscureText: _obscurePassword,
                                  textInputAction: TextInputAction.done,
                                  focusColor: AppTheme.ponPink,
                                  onFieldSubmitted: (_) => _submit(),
                                  validator: (v) {
                                    if (v != _passwordController.text) {
                                      return context.l10n.valPasswordMismatch;
                                    }
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 28),

                                // Submit Button
                                PonButton(
                                  onPressed: _submit,
                                  isLoading: _isLoading,
                                  gradientColors: const [AppTheme.ponPink, AppTheme.ponPeach],
                                  glowColor: AppTheme.ponPink,
                                  child: Text(context.l10n.confirmButton),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
