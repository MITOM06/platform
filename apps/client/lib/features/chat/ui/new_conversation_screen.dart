import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neon_widgets.dart';
import '../data/chat_repository.dart';

class NewConversationScreen extends ConsumerStatefulWidget {
  const NewConversationScreen({super.key});

  @override
  ConsumerState<NewConversationScreen> createState() =>
      _NewConversationScreenState();
}

class _NewConversationScreenState
    extends ConsumerState<NewConversationScreen> {
  final _controller = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final repo = ref.read(chatRepositoryProvider);
      final conv =
          await repo.getOrCreateConversation(_controller.text.trim());
      if (mounted) context.go('/chat/${conv.id}');
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Không tìm thấy người dùng hoặc lỗi kết nối.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cuộc Trò Chuyện Mới'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: Stack(
        children: [
          // Background ambient lights
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.neonCyan.withValues(alpha: 0.08),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.neonPurple.withValues(alpha: 0.08),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // Content
          SafeArea(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: PonLogo(size: 60, showText: false)),
                  const SizedBox(height: 24),
                  
                  NeonCard(
                    glowColor: AppTheme.neonCyan,
                    glowStrength: 4,
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text(
                              'Bắt đầu cuộc trò chuyện',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 16),
                            
                            // User identifier input
                            NeonTextField(
                              controller: _controller,
                              labelText: 'Email hoặc User ID đối phương',
                              prefixIcon: Icons.person_outline_rounded,
                              focusColor: AppTheme.neonCyan,
                              textInputAction: TextInputAction.done,
                              onFieldSubmitted: (_) => _loading ? null : _submit(),
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) {
                                  return 'Vui lòng nhập email hoặc User ID';
                                }
                                return null;
                              },
                            ),
                            
                            if (_error != null) ...[
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 16),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _error!,
                                      style: const TextStyle(
                                        color: Colors.redAccent,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            const SizedBox(height: 24),
                            
                            // Submit Button
                            NeonButton(
                              onPressed: _submit,
                              isLoading: _loading,
                              gradientColors: const [AppTheme.neonCyan, AppTheme.neonBlue],
                              glowColor: AppTheme.neonCyan,
                              child: const Text('BẮT ĐẦU TRÒ CHUYỆN'),
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
        ],
      ),
    );
  }
}
