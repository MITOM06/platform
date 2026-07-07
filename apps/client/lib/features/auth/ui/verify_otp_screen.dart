import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/motion_widgets.dart';
import '../../../core/widgets/otp_6box_input.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../data/auth_repository.dart';
import '../utils/auth_error.dart';

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
        final msg = authErrorToString(context, e);
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

    setState(() => _isLoading = true);
    try {
      // Verify the OTP before advancing. For the forgot-password flow this
      // gates navigation to the new-password screen so a wrong OTP is caught
      // here instead of only after the user enters a new password.
      await ref.read(authRepositoryProvider).verifyOtp(widget.email, otp);
      if (!mounted) return;
      if (widget.isForgotPassword) {
        context.go(
          '/new-password?email=${Uri.encodeComponent(widget.email)}'
          '&otp=${Uri.encodeComponent(otp)}',
        );
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.verifySuccess)));
      context.go('/login');
    } on DioException catch (e) {
      if (mounted) {
        final msg = authErrorToString(context, e);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
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
          // Register verification came from /register; the forgot-password flow
          // came from /login. Send the user back to where they actually were.
          onPressed: () =>
              context.go(widget.isForgotPassword ? '/login' : '/register'),
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
                      const StaggeredEntrance(
                        index: 0,
                        child: Center(child: PonLogo(size: 100, showText: true)),
                      ),
                      const SizedBox(height: 16),
                      StaggeredEntrance(
                        index: 1,
                        child: Text(
                        context.l10n.verifyAccountHeading,
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                        textAlign: TextAlign.center,
                      ),
                      ),
                      const SizedBox(height: 8),
                      StaggeredEntrance(
                        index: 2,
                        child: Text(
                        context.l10n.otpSentTo(widget.email),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          height: 1.5,
                        ),
                      ),
                      ),
                      const SizedBox(height: 32),

                      // OTP Form Card
                      StaggeredEntrance(
                        index: 3,
                        child: PonCard(
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
