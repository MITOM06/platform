import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../data/auth_repository.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  String _friendlyError(BuildContext context, Object error) {
    final msg = error.toString();
    if (msg.contains('409') || msg.contains('exists')) {
      return context.l10n.errEmailExists;
    }
    if (msg.contains('network') || msg.contains('connect')) {
      return context.l10n.errNetwork;
    }
    return context.l10n.errRegisterFailed;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      await ref.read(authRepositoryProvider).register(
            _nameController.text.trim(),
            _emailController.text.trim(),
            _passwordController.text,
          );
      if (mounted) {
        context.go('/verify-otp?email=${Uri.encodeComponent(_emailController.text.trim())}');
      }
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_friendlyError(context, e))));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_friendlyError(context, e))));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.registerTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.go('/login'),
        ),
      ),
      body: Stack(
        children: [
          // Background ambient lights
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.ponPink.withValues(alpha: 0.12),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -120,
            left: -120,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.ponCyan.withValues(alpha: 0.15),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // Content
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Small animated logo icon
                    const Center(child: PonLogo(size: 60, showText: false)),
                    const SizedBox(height: 8),
                    Text(
                      context.l10n.welcomeToApp,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white.withValues(alpha: 0.5),
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),

                    // Register Form Card
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
                              // Full Name
                              PonTextField(
                                controller: _nameController,
                                labelText: context.l10n.fieldDisplayName,
                                prefixIcon: Icons.badge_outlined,
                                focusColor: AppTheme.ponCyan,
                                validator: (v) {
                                  if (v == null || v.trim().isEmpty) return context.l10n.valNameRequired;
                                  if (v.trim().length < 2) return context.l10n.valNameMin2;
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),

                              // Email
                              PonTextField(
                                controller: _emailController,
                                labelText: context.l10n.fieldEmail,
                                prefixIcon: Icons.email_outlined,
                                keyboardType: TextInputType.emailAddress,
                                focusColor: AppTheme.ponCyan,
                                validator: (v) {
                                  if (v == null || v.isEmpty) return context.l10n.valEmailRequired;
                                  if (!v.contains('@')) return context.l10n.valEmailInvalid;
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),

                              // Password
                              PonTextField(
                                controller: _passwordController,
                                labelText: context.l10n.fieldPassword,
                                prefixIcon: Icons.lock_outlined,
                                obscureText: _obscurePassword,
                                focusColor: AppTheme.ponPink,
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
                                  if (v == null || v.isEmpty) return context.l10n.valPasswordRequired;
                                  if (v.length < 6) return context.l10n.valPasswordMin6;
                                  return null;
                                },
                              ),
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

                              // Register Button
                              PonButton(
                                onPressed: _submit,
                                isLoading: _isLoading,
                                gradientColors: const [AppTheme.ponPink, AppTheme.ponPeach],
                                glowColor: AppTheme.ponPink,
                                child: Text(context.l10n.registerButton),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Back to login
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          context.l10n.haveAccount,
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
                        ),
                        TextButton(
                          onPressed: () => context.go('/login'),
                          child: Text(context.l10n.loginLink),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
