import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neon_widgets.dart';
import '../data/auth_repository.dart';

class NewPasswordScreen extends ConsumerStatefulWidget {
  final String email;
  const NewPasswordScreen({super.key, required this.email});

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
            const SnackBar(content: Text('Đặt lại mật khẩu thành công!')));
        context.go('/login');
      }
    } on DioException catch (e) {
      if (mounted) {
        final msg = e.response?.statusCode == 400
            ? 'OTP không đúng hoặc đã hết hạn'
            : 'Đặt lại mật khẩu thất bại, thử lại';
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Đặt lại mật khẩu thất bại, thử lại')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mật Khẩu Mới'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.go('/forgot-password'),
        ),
      ),
      body: Stack(
        children: [
          // Background ambient lights
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
                    AppTheme.neonCyan.withValues(alpha: 0.12),
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
                    AppTheme.neonPink.withValues(alpha: 0.15),
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
                    const Center(child: PonLogo(size: 60, showText: false)),
                    const SizedBox(height: 16),
                    Text(
                      'Tạo mật khẩu mới',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Nhập mã OTP đã gửi đến ${widget.email}\nvà mật khẩu mới của bạn',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.5),
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Reset Form Card
                    NeonCard(
                      glowColor: AppTheme.neonPink,
                      glowStrength: 8,
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // OTP
                              NeonTextField(
                                controller: _otpController,
                                labelText: 'Mã OTP',
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
                                focusColor: AppTheme.neonCyan,
                                validator: (v) {
                                  if (v == null || v.length != 6) return 'Nhập đủ 6 chữ số OTP';
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),

                              // New Password
                              NeonTextField(
                                controller: _passwordController,
                                labelText: 'Mật khẩu mới',
                                prefixIcon: Icons.lock_outlined,
                                obscureText: _obscurePassword,
                                focusColor: AppTheme.neonPink,
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
                                  if (v == null || v.isEmpty) return 'Nhập mật khẩu mới';
                                  if (v.length < 6) return 'Mật khẩu tối thiểu 6 ký tự';
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),

                              // Confirm Password
                              NeonTextField(
                                controller: _confirmController,
                                labelText: 'Xác nhận mật khẩu',
                                prefixIcon: Icons.lock_outline,
                                obscureText: _obscurePassword,
                                textInputAction: TextInputAction.done,
                                focusColor: AppTheme.neonPink,
                                onFieldSubmitted: (_) => _submit(),
                                validator: (v) {
                                  if (v != _passwordController.text) {
                                    return 'Mật khẩu không khớp';
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 28),

                              // Submit Button
                              NeonButton(
                                onPressed: _submit,
                                isLoading: _isLoading,
                                gradientColors: const [AppTheme.neonPink, AppTheme.neonPurple],
                                glowColor: AppTheme.neonPink,
                                child: const Text('XÁC NHẬN'),
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
