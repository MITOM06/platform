import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../core/api/dio_client.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pon_widgets.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../chat/data/chat_repository.dart';
import '../../chat/ui/widgets/conversation_avatar.dart';
import 'widgets/phone_verification_section.dart';

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
  DateTime? _selectedDateOfBirth;
  String? _gender;
  // Phone is verified + saved via the SMS OTP endpoint, NOT via the profile
  // PATCH below. We only track its initial value here so the field can seed
  // its country picker and verified badge.
  String _initialPhone = '';
  bool _initialPhoneVerified = false;
  // Per-field "show to others" privacy toggles, seeded from the current user.
  bool _showDob = true;
  bool _showPhone = true;
  bool _showGender = true;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authNotifierProvider).valueOrNull;
    final current = user is AuthAuthenticated ? user.user : null;
    _nameController = TextEditingController(text: current?.displayName ?? '');
    _bioController = TextEditingController(text: current?.bio ?? '');
    _initialPhone = current?.phoneNumber ?? '';
    _initialPhoneVerified = current?.phoneVerified ?? false;
    _selectedDateOfBirth = current?.dateOfBirth;
    _gender = current?.gender;
    _showDob = current?.effectiveShowDateOfBirth ?? true;
    _showPhone = current?.effectiveShowPhoneNumber ?? true;
    _showGender = current?.effectiveShowGender ?? true;
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

  Future<void> _uploadCover() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile == null) return;

    setState(() => _isLoading = true);
    try {
      final url = await ref.read(chatRepositoryProvider).uploadFile(pickedFile);
      await ref.read(authNotifierProvider.notifier).updateProfile(coverPhoto: url);
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
      // phoneNumber is intentionally omitted — it is persisted only through the
      // SMS OTP verify endpoint (PhoneVerificationSection), so a normal save
      // must not overwrite or clear the verified number.
      await ref.read(authNotifierProvider.notifier).updateProfile(
            displayName: name,
            bio: _bioController.text.trim(),
            gender: _gender,
            dateOfBirth: _selectedDateOfBirth,
            showDateOfBirth: _showDob,
            showPhoneNumber: _showPhone,
            showGender: _showGender,
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
          SnackBar(content: Text(friendlyError(e))),
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
            SizedBox(
              height: 200,
              child: Stack(
                children: [
                  // Cover Photo
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: GestureDetector(
                      onTap: _isLoading ? null : _uploadCover,
                      child: Container(
                        height: 140,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          gradient: const LinearGradient(
                            colors: [AppTheme.ponCyan, AppTheme.ponPink],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Stack(
                          children: [
                            if (user?.coverPhoto != null && user!.coverPhoto!.isNotEmpty)
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: CachedNetworkImage(
                                  imageUrl: user.coverPhoto!.startsWith('http')
                                      ? user.coverPhoto!
                                      : '${DioClient.chatBaseUrl}${user.coverPhoto}',
                                  width: double.infinity,
                                  height: 140,
                                  fit: BoxFit.cover,
                                ),
                              ),
                            Container(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                color: Colors.black.withValues(alpha: 0.25),
                              ),
                            ),
                            const Positioned(
                              top: 8,
                              right: 8,
                              child: CircleAvatar(
                                radius: 16,
                                backgroundColor: Colors.black54,
                                child: Icon(Icons.camera_alt_rounded, color: Colors.white, size: 16),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Avatar
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Stack(
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: AppTheme.darkBackground, width: 4),
                            ),
                            child: ConversationAvatar(
                              avatarUrl: user?.avatarUrl,
                              fallbackLetter: (user?.displayName.isNotEmpty ?? false)
                                  ? user!.displayName[0].toUpperCase()
                                  : '?',
                              size: 96,
                            ),
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
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
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
            const SizedBox(height: 16),
            PhoneVerificationSection(
              initialPhone: _initialPhone,
              initialVerified: _initialPhoneVerified,
              // Phone is saved server-side on verify; nothing to persist on the
              // form's normal save, so we just keep local references in sync.
              onChanged: (phone, verified) {
                _initialPhone = phone;
                _initialPhoneVerified = verified;
              },
            ),
            _PrivacyToggle(
              label: context.l10n.profileShowPhone,
              value: _showPhone,
              onChanged: _isLoading ? null : (v) => setState(() => _showPhone = v),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _gender,
              decoration: InputDecoration(
                labelText: context.l10n.profileGender,
                prefixIcon: const Icon(Icons.wc_outlined, color: AppTheme.ponCyan),
              ),
              items: [
                DropdownMenuItem(value: 'male', child: Text(context.l10n.genderMale)),
                DropdownMenuItem(value: 'female', child: Text(context.l10n.genderFemale)),
                DropdownMenuItem(value: 'other', child: Text(context.l10n.genderOther)),
              ],
              onChanged: _isLoading ? null : (v) => setState(() => _gender = v),
            ),
            _PrivacyToggle(
              label: context.l10n.profileShowGender,
              value: _showGender,
              onChanged: _isLoading ? null : (v) => setState(() => _showGender = v),
            ),
            const SizedBox(height: 8),
            ListTile(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              tileColor: Theme.of(context).colorScheme.surface,
              leading: const Icon(Icons.cake_outlined, color: AppTheme.ponCyan),
              title: Text(context.l10n.dateOfBirth, style: const TextStyle(color: Colors.white)),
              subtitle: Text(
                _selectedDateOfBirth != null
                    ? DateFormat.yMMMd().format(_selectedDateOfBirth!.toLocal())
                    : context.l10n.notSet,
                style: const TextStyle(color: Colors.white70),
              ),
              trailing: const Icon(Icons.calendar_today_rounded, size: 18, color: Colors.white54),
              onTap: _isLoading
                  ? null
                  : () async {
                      final now = DateTime.now();
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _selectedDateOfBirth ?? DateTime(2000, 1, 1),
                        firstDate: DateTime(1900),
                        lastDate: now,
                      );
                      if (picked != null) {
                        setState(() => _selectedDateOfBirth = picked);
                      }
                    },
            ),
            _PrivacyToggle(
              label: context.l10n.profileShowDateOfBirth,
              value: _showDob,
              onChanged: _isLoading ? null : (v) => setState(() => _showDob = v),
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

/// Compact "show to others" privacy switch shown under each gated field.
class _PrivacyToggle extends StatelessWidget {
  final String label;
  final bool value;
  final ValueChanged<bool>? onChanged;
  const _PrivacyToggle({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      value: value,
      onChanged: onChanged,
      title: Text(
        label,
        style: const TextStyle(fontSize: 13, color: Colors.white70),
      ),
      activeThumbColor: AppTheme.ponCyan,
      dense: true,
      contentPadding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
    );
  }
}
