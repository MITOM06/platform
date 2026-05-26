import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neon_widgets.dart';
import '../data/auth_repository.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      await ref
          .read(authRepositoryProvider)
          .forgotPassword(_emailController.text.trim());
      if (mounted) {
        context.go(
            '/new-password?email=${Uri.encodeComponent(_emailController.text.trim())}');
      }
    } on DioException catch (e) {
      if (mounted) {
        final msg = e.response?.statusCode == 404
            ? 'Email này chưa được đăng ký'
            : 'Gửi yêu cầu thất bại, thử lại';
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Gửi yêu cầu thất bại, thử lại')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đặt Lại Mật Khẩu'),
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
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.neonPink.withValues(alpha: 0.12),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -150,
            left: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.neonCyan.withValues(alpha: 0.15),
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
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(child: PonLogo(size: 60, showText: false)),
                    const SizedBox(height: 16),
                    Text(
                      'Quên mật khẩu?',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Nhập email của bạn để nhận mã OTP thiết lập mật khẩu mới',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.5),
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Forgot Form Card
                    NeonCard(
                      glowColor: AppTheme.neonPurple,
                      glowStrength: 8,
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Email
                              NeonTextField(
                                controller: _emailController,
                                labelText: 'Email',
                                prefixIcon: Icons.email_outlined,
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.done,
                                onFieldSubmitted: (_) => _submit(),
                                focusColor: AppTheme.neonCyan,
                                validator: (v) {
                                  if (v == null || v.isEmpty) return 'Vui lòng nhập email';
                                  if (!v.contains('@')) return 'Email không hợp lệ';
                                  return null;
                                },
                              ),
                              const SizedBox(height: 28),

                              // Submit Button
                              NeonButton(
                                onPressed: _submit,
                                isLoading: _isLoading,
                                gradientColors: const [AppTheme.neonPurple, AppTheme.neonPink],
                                glowColor: AppTheme.neonPink,
                                child: const Text('GỬI MÃ OTP'),
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
        ],
      ),
    );
  }
}
