import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../domain/auth_provider.dart';
import '../domain/auth_state.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    // Listen for login errors
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.listenManual<AsyncValue<AuthState>>(authNotifierProvider,
          (_, next) {
        if (next.hasError && mounted) {
          final msg = _friendlyError(context, next.error!); // safe: checked hasError
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
          setState(() => _isLoading = false);
        }
      });
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String _friendlyError(BuildContext context, Object error) {
    final msg = error.toString();
    if (msg.contains('401') || msg.contains('Invalid')) {
      return context.l10n.errInvalidCredentials;
    }
    if (msg.contains('network') || msg.contains('connect')) {
      return context.l10n.errNetwork;
    }
    return context.l10n.errLoginFailed;
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
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    await ref
        .read(authNotifierProvider.notifier)
        .login(_emailController.text.trim(), _passwordController.text);
    // Router auto-redirects on success; error handled by listener above
    if (mounted) setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background ambient lights
          Positioned(
            top: -120,
            left: -120,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.ponCyan.withValues(alpha: 0.18),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -150,
            right: -100,
            child: Container(
              width: 380,
              height: 380,
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
          Positioned(
            top: 250,
            right: -120,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.ponPeach.withValues(alpha: 0.12),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // Scrollable main content
          SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 450),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Brand Logo
                      const Center(child: PonLogo(size: 100, showText: true)),
                    const SizedBox(height: 40),

                    // Frosted Glass Form Card
                    PonCard(
                      glowColor: AppTheme.ponCyan,
                      glowStrength: 8,
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                context.l10n.loginTitle,
                                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 28),

                              // Email
                              PonTextField(
                                controller: _emailController,
                                labelText: context.l10n.fieldEmail,
                                prefixIcon: Icons.email_outlined,
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                focusColor: AppTheme.ponCyan,
                                validator: (v) {
                                  if (v == null || v.isEmpty) return context.l10n.valEmailRequired;
                                  if (!v.contains('@')) return context.l10n.valEmailInvalid;
                                  return null;
                                },
                              ),
                              const SizedBox(height: 20),

                              // Password
                              PonTextField(
                                controller: _passwordController,
                                labelText: context.l10n.fieldPassword,
                                prefixIcon: Icons.lock_outlined,
                                obscureText: _obscurePassword,
                                textInputAction: TextInputAction.done,
                                focusColor: AppTheme.ponPink,
                                onFieldSubmitted: (_) => _submit(),
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

                              // Forgot password
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed: () => context.go('/forgot-password'),
                                  child: Text(context.l10n.forgotPasswordLink),
                                ),
                              ),
                              const SizedBox(height: 12),

                              // Submit Button
                              PonButton(
                                onPressed: _submit,
                                isLoading: _isLoading,
                                gradientColors: const [AppTheme.ponCyan, AppTheme.ponCyan],
                                glowColor: AppTheme.ponCyan,
                                child: Text(context.l10n.loginButton),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                      // OAuth divider
                      Row(
                        children: [
                          const Expanded(child: Divider(color: Colors.white24)),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Text(
                              context.l10n.orContinueWith,
                              style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12),
                            ),
                          ),
                          const Expanded(child: Divider(color: Colors.white24)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: () => _launchOAuth('google'),
                        icon: const Text('G', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF4285F4))),
                        label: Text(context.l10n.loginWithGoogle),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
                        ),
                      ),


                      // Navigation to register
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            context.l10n.noAccountYet,
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
                          ),
                          TextButton(
                            onPressed: () => context.go('/register'),
                            child: Text(context.l10n.registerNow),
                          ),
                        ],
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
