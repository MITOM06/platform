import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../chat/data/chat_repository.dart';
import '../../../chat/ui/widgets/conversation_avatar.dart';

/// Profile avatar with a camera badge that opens the gallery and uploads a new
/// avatar. Extracted from settings_dialogs.dart (clean-code file limit).
class SettingsAvatarSection extends ConsumerStatefulWidget {
  const SettingsAvatarSection({super.key});

  @override
  ConsumerState<SettingsAvatarSection> createState() =>
      _SettingsAvatarSectionState();
}

class _SettingsAvatarSectionState extends ConsumerState<SettingsAvatarSection> {
  bool _uploading = false;

  Future<void> _uploadAvatar() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile == null) return;
    setState(() => _uploading = true);
    try {
      final url = await ref.read(chatRepositoryProvider).uploadFile(pickedFile);
      await ref
          .read(authNotifierProvider.notifier)
          .updateProfile(avatarUrl: url);
    } catch (_) {
      if (mounted) {
        showErrorSnackBar(context.l10n.uploadFailed);
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authAsync = ref.watch(authNotifierProvider);
    final user = authAsync.valueOrNull is AuthAuthenticated
        ? (authAsync.value! as AuthAuthenticated).user
        : null;
    final initials = user != null && user.displayName.isNotEmpty
        ? user.displayName.trim()[0].toUpperCase()
        : '?';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: isDark
              ? const [AppTheme.ponCyan, AppTheme.ponPink]
              : [
                  Theme.of(context).colorScheme.primary,
                  Theme.of(context).colorScheme.secondary
                ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: isDark
            ? [
                BoxShadow(
                  color: AppTheme.ponCyan.withValues(alpha: 0.2),
                  blurRadius: 16,
                )
              ]
            : null,
      ),
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isDark ? AppTheme.darkBackground : Colors.white,
        ),
        child: GestureDetector(
          onTap: _uploading ? null : _uploadAvatar,
          child: Stack(
            alignment: Alignment.center,
            children: [
              ConversationAvatar(
                avatarUrl: user?.avatarUrl,
                fallbackLetter: initials,
                size: 96,
              ),
              Positioned(
                bottom: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: AppTheme.ponCyan,
                    shape: BoxShape.circle,
                  ),
                  child: _uploading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.camera_alt,
                          color: Colors.white, size: 16),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
