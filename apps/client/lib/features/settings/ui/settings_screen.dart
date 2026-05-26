import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/neon_widgets.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _nameController;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authNotifierProvider).valueOrNull;
    final displayName =
        user is AuthAuthenticated ? user.user.displayName : '';
    _nameController = TextEditingController(text: displayName);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tên không được để trống')),
      );
      return;
    }
    setState(() => _isLoading = true);
    try {
      await ref
          .read(authNotifierProvider.notifier)
          .updateDisplayName(name);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã cập nhật tên hiển thị')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authAsync = ref.watch(authNotifierProvider);
    final user =
        authAsync.valueOrNull is AuthAuthenticated
            ? (authAsync.value! as AuthAuthenticated).user
            : null;
    final initials = user != null && user.displayName.isNotEmpty
        ? user.displayName.trim()[0].toUpperCase()
        : '?';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cài Đặt'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20.0),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(AppTheme.neonCyan),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: TextButton(
                onPressed: _save,
                child: const Text('LƯU'),
              ),
            ),
        ],
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

          // Main content
          SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 16),
                
                // Avatar with double neon ring
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [AppTheme.neonCyan, AppTheme.neonPink],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.neonCyan.withValues(alpha: 0.2),
                        blurRadius: 16,
                      ),
                    ],
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppTheme.obsidianBackground,
                    ),
                    child: CircleAvatar(
                      radius: 48,
                      backgroundColor: AppTheme.darkSurface,
                      child: Text(
                        initials,
                        style: const TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.neonCyan,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  user?.email ?? '',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.4),
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 36),

                // Form card
                NeonCard(
                  glowColor: AppTheme.neonCyan,
                  glowStrength: 4,
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Thông tin cá nhân',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 16),
                        NeonTextField(
                          controller: _nameController,
                          labelText: 'Tên hiển thị',
                          prefixIcon: Icons.badge_outlined,
                          focusColor: AppTheme.neonCyan,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _save(),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Logout option card
                NeonCard(
                  glowColor: Colors.redAccent,
                  glowStrength: 0,
                  borderOpacity: 0.15,
                  child: Material(
                    color: Colors.transparent,
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.redAccent.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 20),
                      ),
                      title: const Text(
                        'Đăng xuất',
                        style: TextStyle(
                          color: Colors.redAccent,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      trailing: const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white24, size: 16),
                      onTap: () async {
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            backgroundColor: AppTheme.darkSurface,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                              side: BorderSide(color: AppTheme.darkBorder.withValues(alpha: 0.5)),
                            ),
                            title: const Text(
                              'Đăng xuất',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            content: const Text('Bạn có chắc muốn đăng xuất không?'),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx, false),
                                child: Text(
                                  'Huỷ',
                                  style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
                                ),
                              ),
                              FilledButton(
                                style: FilledButton.styleFrom(
                                  backgroundColor: Colors.redAccent,
                                  foregroundColor: Colors.white,
                                ),
                                onPressed: () => Navigator.pop(ctx, true),
                                child: const Text('Đăng xuất'),
                              ),
                            ],
                          ),
                        );
                        if (confirm == true && mounted) {
                          await ref.read(authNotifierProvider.notifier).logout();
                        }
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
