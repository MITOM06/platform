import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../chat/data/chat_repository.dart';
import '../../chat/ui/widgets/conversation_avatar.dart';

/// Lets the signed-in user edit their own profile (avatar, display name, bio).
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  late final TextEditingController _nameController;
  late final TextEditingController _bioController;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authNotifierProvider).valueOrNull;
    final current = user is AuthAuthenticated ? user.user : null;
    _nameController = TextEditingController(text: current?.displayName ?? '');
    _bioController = TextEditingController(text: current?.bio ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _uploadAvatar() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile == null) return;

    setState(() => _isLoading = true);
    try {
      final url = await ref.read(chatRepositoryProvider).uploadFile(pickedFile);
      await ref.read(authNotifierProvider.notifier).updateProfile(avatarUrl: url);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.uploadFailed)),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.valNameEmpty)),
      );
      return;
    }
    setState(() => _isLoading = true);
    try {
      await ref.read(authNotifierProvider.notifier).updateProfile(
            displayName: name,
            bio: _bioController.text.trim(),
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.nameUpdated)),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.errorWithMsg(e.toString()))),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider).valueOrNull;
    final user = authState is AuthAuthenticated ? authState.user : null;

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.editProfile)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Center(
              child: Stack(
                children: [
                  ConversationAvatar(
                    avatarUrl: user?.avatarUrl,
                    fallbackLetter: (user?.displayName.isNotEmpty ?? false)
                        ? user!.displayName[0].toUpperCase()
                        : '?',
                    size: 96,
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: GestureDetector(
                      onTap: _isLoading ? null : _uploadAvatar,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                          color: AppTheme.ponCyan,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.camera_alt_rounded,
                            size: 18, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: TextButton(
                onPressed: _isLoading ? null : _uploadAvatar,
                child: Text(context.l10n.changeAvatar),
              ),
            ),
            const SizedBox(height: 16),
            PonTextField(
              controller: _nameController,
              labelText: context.l10n.fieldDisplayName,
              prefixIcon: Icons.person_outline_rounded,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),
            PonTextField(
              controller: _bioController,
              labelText: context.l10n.bio,
              prefixIcon: Icons.info_outline_rounded,
              keyboardType: TextInputType.multiline,
              textInputAction: TextInputAction.newline,
              maxLength: 160,
            ),
            const SizedBox(height: 24),
            PonButton(
              onPressed: _isLoading ? null : _save,
              isLoading: _isLoading,
              child: Text(context.l10n.actionSave),
            ),
          ],
        ),
      ),
    );
  }
}
