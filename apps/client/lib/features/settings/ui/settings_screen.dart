import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/theme_provider.dart';
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

  IconData _getThemeIcon(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.light:
        return Icons.light_mode_rounded;
      case ThemeMode.dark:
        return Icons.dark_mode_rounded;
      case ThemeMode.system:
        return Icons.brightness_auto_rounded;
    }
  }

  String _getThemeLabel(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.light:
        return 'Giao diện Sáng';
      case ThemeMode.dark:
        return 'Giao diện Tối';
      case ThemeMode.system:
        return 'Hệ thống';
    }
  }

  void _showThemeSelectionDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return AlertDialog(
          backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(
              color: isDark 
                  ? AppTheme.darkBorder.withValues(alpha: 0.5) 
                  : Colors.black.withValues(alpha: 0.08),
            ),
          ),
          title: Text(
            'Chọn giao diện',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          content: const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _ThemeDialogOption(
                title: 'Giao diện Sáng',
                icon: Icons.light_mode_rounded,
                themeMode: ThemeMode.light,
                activeColor: Colors.amber,
              ),
              SizedBox(height: 8),
              _ThemeDialogOption(
                title: 'Giao diện Tối',
                icon: Icons.dark_mode_rounded,
                themeMode: ThemeMode.dark,
                activeColor: AppTheme.neonCyan,
              ),
              SizedBox(height: 8),
              _ThemeDialogOption(
                title: 'Hệ thống',
                icon: Icons.brightness_auto_rounded,
                themeMode: ThemeMode.system,
                activeColor: AppTheme.neonPurple,
              ),
            ],
          ),
        );
      },
    );
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

    final currentThemeMode = ref.watch(themeModeNotifierProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cài Đặt'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          if (_isLoading)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    isDark ? AppTheme.neonCyan : Theme.of(context).colorScheme.primary,
                  ),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: TextButton(
                onPressed: _save,
                style: TextButton.styleFrom(
                  foregroundColor: isDark ? AppTheme.neonCyan : Theme.of(context).colorScheme.primary,
                ),
                child: const Text('LƯU'),
              ),
            ),
        ],
      ),
      body: Stack(
        children: [
          // Background ambient lights
          if (isDark) ...[
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
          ],

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
                    gradient: LinearGradient(
                      colors: isDark 
                          ? const [AppTheme.neonCyan, AppTheme.neonPink]
                          : [Theme.of(context).colorScheme.primary, Theme.of(context).colorScheme.secondary],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: isDark
                        ? [
                            BoxShadow(
                              color: AppTheme.neonCyan.withValues(alpha: 0.2),
                              blurRadius: 16,
                            ),
                          ]
                        : null,
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isDark ? AppTheme.obsidianBackground : Colors.white,
                    ),
                    child: CircleAvatar(
                      radius: 48,
                      backgroundColor: isDark ? AppTheme.darkSurface : Colors.grey.shade100,
                      child: Text(
                        initials,
                        style: TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.w900,
                          color: isDark ? AppTheme.neonCyan : Theme.of(context).colorScheme.primary,
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
                    color: isDark ? Colors.white.withValues(alpha: 0.4) : Colors.black54,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 36),

                // Form card
                NeonCard(
                  glowColor: AppTheme.neonCyan,
                  glowStrength: isDark ? 4 : 0,
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Thông tin cá nhân',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 16),
                        NeonTextField(
                          controller: _nameController,
                          labelText: 'Tên hiển thị',
                          prefixIcon: Icons.badge_outlined,
                          focusColor: isDark ? AppTheme.neonCyan : Theme.of(context).colorScheme.primary,
                          textInputAction: TextInputAction.done,
                          style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                          onFieldSubmitted: (_) => _save(),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Theme preference card
                NeonCard(
                  glowColor: AppTheme.neonPurple,
                  glowStrength: isDark ? 4 : 0,
                  child: Material(
                    color: Colors.transparent,
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: (isDark ? AppTheme.neonPurple : Theme.of(context).colorScheme.primary).withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _getThemeIcon(currentThemeMode),
                          color: isDark ? AppTheme.neonPurple : Theme.of(context).colorScheme.primary,
                          size: 20,
                        ),
                      ),
                      title: Text(
                        'Giao diện',
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      subtitle: Text(
                        _getThemeLabel(currentThemeMode),
                        style: TextStyle(
                          color: isDark ? Colors.white54 : Colors.black54,
                          fontSize: 13,
                        ),
                      ),
                      trailing: Icon(
                        Icons.arrow_forward_ios_rounded,
                        color: isDark ? Colors.white24 : Colors.black26,
                        size: 16,
                      ),
                      onTap: () => _showThemeSelectionDialog(context, ref),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Logout option card
                NeonCard(
                  glowColor: Colors.redAccent,
                  glowStrength: 0,
                  borderOpacity: isDark ? 0.15 : 0.08,
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
                      trailing: Icon(
                        Icons.arrow_forward_ios_rounded,
                        color: isDark ? Colors.white24 : Colors.black26,
                        size: 16,
                      ),
                      onTap: () async {
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                              side: BorderSide(
                                color: isDark 
                                    ? AppTheme.darkBorder.withValues(alpha: 0.5) 
                                    : Colors.black.withValues(alpha: 0.08),
                              ),
                            ),
                            title: Text(
                              'Đăng xuất',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                            content: Text(
                              'Bạn có chắc muốn đăng xuất không?',
                              style: TextStyle(
                                color: isDark ? Colors.white70 : Colors.black87,
                              ),
                            ),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx, false),
                                child: Text(
                                  'Huỷ',
                                  style: TextStyle(
                                    color: isDark ? Colors.white.withValues(alpha: 0.6) : Colors.black54,
                                  ),
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

class _ThemeDialogOption extends ConsumerWidget {
  final String title;
  final IconData icon;
  final ThemeMode themeMode;
  final Color activeColor;

  const _ThemeDialogOption({
    required this.title,
    required this.icon,
    required this.themeMode,
    required this.activeColor,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentMode = ref.watch(themeModeNotifierProvider);
    final isSelected = currentMode == themeMode;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ListTile(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      leading: Icon(
        icon,
        color: isSelected ? activeColor : (isDark ? Colors.white54 : Colors.black54),
      ),
      title: Text(
        title,
        style: TextStyle(
          color: isSelected
              ? activeColor
              : (isDark ? Colors.white70 : Colors.black87),
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      trailing: isSelected
          ? Icon(Icons.check_circle_rounded, color: activeColor, size: 20)
          : null,
      onTap: () {
        ref.read(themeModeNotifierProvider.notifier).setThemeMode(themeMode);
        Navigator.pop(context);
      },
    );
  }
}

