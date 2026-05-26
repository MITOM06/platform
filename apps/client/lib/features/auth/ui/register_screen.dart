import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neon_widgets.dart';
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

  String _friendlyError(Object error) {
    final msg = error.toString();
    if (msg.contains('409') || msg.contains('exists')) {
      return 'Email này đã được đăng ký';
    }
    if (msg.contains('network') || msg.contains('connect')) {
      return 'Không thể kết nối server';
    }
    return 'Đăng ký thất bại, thử lại';
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
            SnackBar(content: Text(_friendlyError(e))));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_friendlyError(e))));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tạo Tài Khoản'),
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
                    AppTheme.neonPink.withValues(alpha: 0.12),
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
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Small animated logo icon
                    const Center(child: PonLogo(size: 60, showText: false)),
                    const SizedBox(height: 8),
                    Text(
                      'Chào mừng bạn đến với PON',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white.withValues(alpha: 0.5),
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),

                    // Register Form Card
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
                              // Full Name
                              NeonTextField(
                                controller: _nameController,
                                labelText: 'Tên hiển thị',
                                prefixIcon: Icons.badge_outlined,
                                focusColor: AppTheme.neonCyan,
                                validator: (v) {
                                  if (v == null || v.trim().isEmpty) return 'Vui lòng nhập tên';
                                  if (v.trim().length < 2) return 'Tên tối thiểu 2 ký tự';
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),

                              // Email
                              NeonTextField(
                                controller: _emailController,
                                labelText: 'Email',
                                prefixIcon: Icons.email_outlined,
                                keyboardType: TextInputType.emailAddress,
                                focusColor: AppTheme.neonCyan,
                                validator: (v) {
                                  if (v == null || v.isEmpty) return 'Vui lòng nhập email';
                                  if (!v.contains('@')) return 'Email không hợp lệ';
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),

                              // Password
                              NeonTextField(
                                controller: _passwordController,
                                labelText: 'Mật khẩu',
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
                                  if (v == null || v.isEmpty) return 'Vui lòng nhập mật khẩu';
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

                              // Register Button
                              NeonButton(
                                onPressed: _submit,
                                isLoading: _isLoading,
                                gradientColors: const [AppTheme.neonPink, AppTheme.neonPurple],
                                glowColor: AppTheme.neonPink,
                                child: const Text('ĐĂNG KÝ'),
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
                          'Đã có tài khoản? ',
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
                        ),
                        TextButton(
                          onPressed: () => context.go('/login'),
                          child: const Text('Đăng nhập'),
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
