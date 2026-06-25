import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/motion_widgets.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../data/auth_repository.dart';
import '../utils/auth_error.dart';
import 'widgets/password_strength_indicator.dart';
import 'widgets/register_footer.dart';

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
  bool _agreeToTerms = false;
  String _passwordValue = '';

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  String _friendlyError(BuildContext context, Object error) {
    if (error is DioException) {
      return authErrorToString(context, error);
    }
    final msg = error.toString();
    if (msg.contains('network') || msg.contains('connect')) {
      return context.l10n.errNetwork;
    }
    return context.l10n.errRegisterFailed;
  }

  Future<void> _launchOAuth(String provider) async {
    const authBase = String.fromEnvironment('AUTH_BASE_URL', defaultValue: 'https://auth-service-942942821810.asia-southeast1.run.app');
    final uri = Uri.parse('$authBase/auth/social/$provider/init?platform=mobile');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.errCannotOpenLink)),
      );
    }
  }

  Future<void> _submit() async {
    if (!_agreeToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.valMustAgreeTerms)),
      );
      return;
    }
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
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 450),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const StaggeredEntrance(
                        index: 0,
                        child: Center(child: PonLogo(size: 100, showText: true)),
                      ),
                      const SizedBox(height: 24),

                    // Register Form Card
                    StaggeredEntrance(
                      index: 1,
                      child: PonCard(
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
                                onChanged: (v) => setState(() => _passwordValue = v),
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
                                  if (v.length < 8) return context.l10n.valPasswordMin8;
                                  if (!v.contains(RegExp(r'[A-Z]'))) return context.l10n.valPasswordUppercase;
                                  if (!v.contains(RegExp(r'[a-z]'))) return context.l10n.valPasswordLowercase;
                                  if (!v.contains(RegExp(r'[0-9]'))) return context.l10n.valPasswordDigit;
                                  if (!v.contains(RegExp(r'[!@#$%^&*]'))) return context.l10n.valPasswordSpecial;
                                  return null;
                                },
                              ),
                              PasswordStrengthIndicator(password: _passwordValue),
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
                              const SizedBox(height: 16),

                              // Terms Agreement
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  SizedBox(
                                    height: 24,
                                    width: 24,
                                    child: Checkbox(
                                      value: _agreeToTerms,
                                      onChanged: (val) {
                                        setState(() => _agreeToTerms = val ?? false);
                                      },
                                      activeColor: AppTheme.ponPink,
                                      side: BorderSide(color: Colors.white.withValues(alpha: 0.5)),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () {
                                        setState(() => _agreeToTerms = !_agreeToTerms);
                                      },
                                      child: RichText(
                                        text: TextSpan(
                                          style: TextStyle(
                                            color: Colors.white.withValues(alpha: 0.7),
                                            fontSize: 13,
                                          ),
                                          children: _buildTermsTextSpans(context),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
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
                    ),
                    const SizedBox(height: 24),

                      RegisterFooter(onGoogle: () => _launchOAuth('google')),
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

  List<InlineSpan> _buildTermsTextSpans(BuildContext context) {
    final text = context.l10n.agreeToTerms('__PRIVACY__', '__TERMS__');
    final parts = text.split(RegExp(r'(__PRIVACY__|__TERMS__)'));
    final matches = RegExp(r'(__PRIVACY__|__TERMS__)').allMatches(text).toList();

    final spans = <InlineSpan>[];
    for (int i = 0; i < parts.length; i++) {
      if (parts[i].isNotEmpty) {
        spans.add(TextSpan(text: parts[i]));
      }
      if (i < matches.length) {
        final match = matches[i].group(0);
        final isPrivacy = match == '__PRIVACY__';
        spans.add(WidgetSpan(
          alignment: PlaceholderAlignment.baseline,
          baseline: TextBaseline.alphabetic,
          child: GestureDetector(
            onTap: () async {
              final uri = Uri.parse(
                  'https://platform-phi-gules.vercel.app/${isPrivacy ? "privacy" : "terms"}');
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            child: Text(
              isPrivacy ? context.l10n.privacyPolicy : context.l10n.termsOfService,
              style: const TextStyle(
                color: AppTheme.ponPink,
                fontWeight: FontWeight.bold,
                decoration: TextDecoration.underline,
                decorationColor: AppTheme.ponPink,
              ),
            ),
          ),
        ));
      }
    }
    return spans;
  }
}
