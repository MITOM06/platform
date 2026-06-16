import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/otp_6box_input.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../data/auth_repository.dart';

class VerifyOtpScreen extends ConsumerStatefulWidget {
  final String email;
  final bool isForgotPassword;

  const VerifyOtpScreen({
    super.key,
    required this.email,
    this.isForgotPassword = false,
  });

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
            SnackBar(content: Text(context.l10n.otpResent)));
        _startCooldown(60);
      }
    } on DioException catch (e) {
      if (mounted) {
        String msg = context.l10n.errResendFailed;
        final data = e.response?.data;
        if (data is Map) {
          final raw = data['message'];
          if (raw is String && raw.isNotEmpty) {
            msg = raw;
          } else if (raw is List && raw.isNotEmpty) {
            msg = raw.join(', ');
          }
        }
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.l10n.errResendFailed)));
      }
    } finally {
      if (mounted) setState(() => _isResending = false);
    }
  }

  Future<void> _submit() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.valOtp6)));
      return;
    }

    if (widget.isForgotPassword) {
      context.go(
        '/new-password?email=${Uri.encodeComponent(widget.email)}'
        '&otp=${Uri.encodeComponent(otp)}',
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      await ref.read(authRepositoryProvider).verifyOtp(widget.email, otp);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.l10n.verifySuccess)));
        context.go('/login');
      }
    } on DioException catch (e) {
      if (mounted) {
        final msg = (e.response?.data is Map)
            ? (e.response!.data['message'] as String? ?? context.l10n.errVerifyFailed)
            : context.l10n.errVerifyFailed;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.l10n.errVerifyFailed)));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.verifyOtpTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.go('/login'),
        ),
      ),
      body: Stack(
        children: [
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
                    AppTheme.ponCyan.withValues(alpha: 0.12),
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
                    AppTheme.ponPeach.withValues(alpha: 0.15),
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
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Center(child: PonLogo(size: 100, showText: true)),
                      const SizedBox(height: 16),
                      Text(
                        context.l10n.verifyAccountHeading,
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        context.l10n.otpSentTo(widget.email),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 32),

                      // OTP Form Card
                      PonCard(
                        glowColor: AppTheme.ponCyan,
                        glowStrength: 8,
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // 6-box OTP input
                              Otp6BoxInput(
                                controller: _otpController,
                                accentColor: AppTheme.ponCyan,
                                onCompleted: (_) => _submit(),
                              ),
                              const SizedBox(height: 28),

                              // Submit Button
                              PonButton(
                                onPressed: _submit,
                                isLoading: _isLoading,
                                gradientColors: const [AppTheme.ponCyan, AppTheme.ponCyan],
                                glowColor: AppTheme.ponCyan,
                                child: Text(context.l10n.confirmButton),
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
                                              ? context.l10n.resendIn(_resendCooldown)
                                              : context.l10n.resendOtp,
                                          style: TextStyle(
                                            color: _resendCooldown > 0
                                                ? Colors.white38
                                                : AppTheme.ponCyan,
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
          ),
        ],
      ),
    );
  }
}
