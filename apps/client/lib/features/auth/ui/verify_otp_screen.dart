import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neon_widgets.dart';
import '../data/auth_repository.dart';

class VerifyOtpScreen extends ConsumerStatefulWidget {
  final String email;
  const VerifyOtpScreen({super.key, required this.email});

  @override
  ConsumerState<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends ConsumerState<VerifyOtpScreen> {
  final _otpController = TextEditingController();
  bool _isLoading = false;
  bool _isResending = false;
  int _resendCooldown = 0;
  Timer? _cooldownTimer;

  @override
  void initState() {
    super.initState();
    _startCooldown(60);
  }

  @override
  void dispose() {
    _otpController.dispose();
    _cooldownTimer?.cancel();
    super.dispose();
  }

  void _startCooldown(int seconds) {
    setState(() => _resendCooldown = seconds);
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendCooldown <= 1) {
        timer.cancel();
        if (mounted) setState(() => _resendCooldown = 0);
      } else {
        if (mounted) setState(() => _resendCooldown--);
      }
    });
  }

  Future<void> _resend() async {
    if (_resendCooldown > 0 || _isResending) return;
    setState(() => _isResending = true);
    try {
      await ref.read(authRepositoryProvider).resendOtp(widget.email);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Mã OTP mới đã được gửi tới email của bạn')));
        _startCooldown(60);
      }
    } on DioException catch (e) {
      if (mounted) {
        final msg = e.response?.data?['message'] ?? 'Gửi lại thất bại, thử lại sau';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Gửi lại thất bại, thử lại sau')));
      }
    } finally {
      if (mounted) setState(() => _isResending = false);
    }
  }

  Future<void> _submit() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Nhập đủ 6 chữ số OTP')));
      return;
    }
    setState(() => _isLoading = true);
    try {
      await ref.read(authRepositoryProvider).verifyOtp(widget.email, otp);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Xác thực thành công! Đăng nhập ngay')));
        context.go('/login');
      }
    } on DioException catch (e) {
      if (mounted) {
        final msg = (e.response?.data is Map)
            ? (e.response!.data['message'] as String? ?? 'Xác thực thất bại, thử lại')
            : 'Xác thực thất bại, thử lại';
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Xác thực thất bại, thử lại')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Xác Thực OTP'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.go('/login'),
        ),
      ),
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
                    AppTheme.neonCyan.withValues(alpha: 0.12),
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
                    AppTheme.neonPurple.withValues(alpha: 0.15),
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
                      'Xác thực tài khoản',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Mã OTP 6 chữ số đã gửi đến\n${widget.email}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.5),
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // OTP Form Card
                    NeonCard(
                      glowColor: AppTheme.neonCyan,
                      glowStrength: 8,
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // OTP input field
                            NeonTextField(
                              controller: _otpController,
                              labelText: 'Mã OTP',
                              prefixIcon: Icons.pin_outlined,
                              keyboardType: TextInputType.number,
                              maxLength: 6,
                              counterText: '',
                              style: const TextStyle(
                                fontSize: 24,
                                letterSpacing: 8,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                              textInputAction: TextInputAction.done,
                              onFieldSubmitted: (_) => _submit(),
                              focusColor: AppTheme.neonCyan,
                            ),
                            const SizedBox(height: 28),

                            // Submit Button
                            NeonButton(
                              onPressed: _submit,
                              isLoading: _isLoading,
                              gradientColors: const [AppTheme.neonCyan, AppTheme.neonBlue],
                              glowColor: AppTheme.neonCyan,
                              child: const Text('XÁC NHẬN'),
                            ),
                            const SizedBox(height: 16),

                            // Resend OTP Button
                            Center(
                              child: _isResending
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : TextButton(
                                      onPressed: _resendCooldown > 0 ? null : _resend,
                                      child: Text(
                                        _resendCooldown > 0
                                            ? 'Gửi lại sau ${_resendCooldown}s'
                                            : 'Gửi lại mã OTP',
                                        style: TextStyle(
                                          color: _resendCooldown > 0
                                              ? Colors.white38
                                              : AppTheme.neonCyan,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                            ),
                          ],
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
