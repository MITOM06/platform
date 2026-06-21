import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/api/dio_client.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../chat/data/chat_repository.dart';
import '../../../chat/domain/chat_provider.dart';
import 'user_profile_actions.dart';
import 'user_profile_info_section.dart';

/// Shows a compact profile dialog for any user.
/// Tapping avatar/name elsewhere in the app should call [showUserProfileDialog].
void showUserProfileDialog(BuildContext context, String userId) {
  showDialog(
    context: context,
    builder: (_) => UserProfileDialog(userId: userId),
  );
}

class UserProfileDialog extends ConsumerStatefulWidget {
  final String userId;
  const UserProfileDialog({super.key, required this.userId});

  @override
  ConsumerState<UserProfileDialog> createState() => _UserProfileDialogState();
}

class _UserProfileDialogState extends ConsumerState<UserProfileDialog> {
  bool _editMode = false;
  bool _saving = false;
  bool _fieldsInitialized = false;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _bioCtrl;
  late final TextEditingController _phoneCtrl;
  String? _gender;
  DateTime? _dob;
  // Per-field "show to others" toggle state, seeded from the profile on enter.
  bool _showDob = true;
  bool _showPhone = true;
  bool _showGender = true;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController();
    _bioCtrl = TextEditingController();
    _phoneCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _bioCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  void _initEditFields(UserModel user) {
    if (!_editMode || _fieldsInitialized) return;
    _nameCtrl.text = user.displayName;
    _bioCtrl.text = user.bio ?? '';
    _phoneCtrl.text = user.phoneNumber ?? '';
    _gender = user.gender;
    _dob = user.dateOfBirth;
    _showDob = user.effectiveShowDateOfBirth;
    _showPhone = user.effectiveShowPhoneNumber;
    _showGender = user.effectiveShowGender;
    _fieldsInitialized = true;
  }

  Future<void> _save(UserModel current) async {
    setState(() => _saving = true);
    try {
      await ref.read(authNotifierProvider.notifier).updateProfile(
            displayName: _nameCtrl.text.trim().isEmpty ? null : _nameCtrl.text.trim(),
            bio: _bioCtrl.text.trim(),
            phoneNumber: _phoneCtrl.text.trim(),
            gender: _gender,
            dateOfBirth: _dob,
            showDateOfBirth: _showDob,
            showPhoneNumber: _showPhone,
            showGender: _showGender,
          );
      if (mounted) setState(() { _editMode = false; _fieldsInitialized = false; });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.errorWithMsg(e.toString()))),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _uploadAvatar() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;
    final url = await ref.read(chatRepositoryProvider).uploadFile(picked);
    await ref.read(authNotifierProvider.notifier).updateProfile(avatarUrl: url);
  }

  Future<void> _pickDate(UserModel user) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(2000),
      firstDate: DateTime(1920),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _dob = picked);
  }

  @override
  Widget build(BuildContext context) {
    final authAsync = ref.watch(authNotifierProvider);
    final currentUser = authAsync.valueOrNull is AuthAuthenticated
        ? (authAsync.valueOrNull as AuthAuthenticated).user
        : null;
    final isSelf = currentUser?.id == widget.userId;

    final profileAsync = isSelf
        ? null
        : ref.watch(userProfileProvider(widget.userId));
    final profile = isSelf ? currentUser : profileAsync?.valueOrNull;

    if (profile != null && _editMode) _initEditFields(profile);

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: _ProfileDialogContent(
          profile: profile,
          isSelf: isSelf,
          editMode: _editMode,
          saving: _saving,
          nameCtrl: _nameCtrl,
          bioCtrl: _bioCtrl,
          phoneCtrl: _phoneCtrl,
          gender: _gender,
          dob: _dob,
          showDateOfBirth: _showDob,
          showPhoneNumber: _showPhone,
          showGender: _showGender,
          onToggleShowDateOfBirth: (v) => setState(() => _showDob = v),
          onToggleShowPhoneNumber: (v) => setState(() => _showPhone = v),
          onToggleShowGender: (v) => setState(() => _showGender = v),
          onToggleEdit: () {
            setState(() {
              _editMode = !_editMode;
              if (_editMode) _fieldsInitialized = false; // re-read profile on enter
            });
          },
          onSave: profile != null ? () => _save(profile) : null,
          onUploadAvatar: _uploadAvatar,
          onGenderChange: (v) => setState(() => _gender = v),
          onPickDate: profile != null ? () => _pickDate(profile) : null,
          userId: widget.userId,
          currentUserId: currentUser?.id,
        ),
      ),
    );
  }
}

class _ProfileDialogContent extends ConsumerWidget {
  final UserModel? profile;
  final bool isSelf;
  final bool editMode;
  final bool saving;
  final TextEditingController nameCtrl;
  final TextEditingController bioCtrl;
  final TextEditingController phoneCtrl;
  final String? gender;
  final DateTime? dob;
  final bool showDateOfBirth;
  final bool showPhoneNumber;
  final bool showGender;
  final ValueChanged<bool> onToggleShowDateOfBirth;
  final ValueChanged<bool> onToggleShowPhoneNumber;
  final ValueChanged<bool> onToggleShowGender;
  final VoidCallback onToggleEdit;
  final VoidCallback? onSave;
  final VoidCallback onUploadAvatar;
  final ValueChanged<String?> onGenderChange;
  final VoidCallback? onPickDate;
  final String userId;
  final String? currentUserId;

  const _ProfileDialogContent({
    required this.profile,
    required this.isSelf,
    required this.editMode,
    required this.saving,
    required this.nameCtrl,
    required this.bioCtrl,
    required this.phoneCtrl,
    required this.gender,
    required this.dob,
    required this.showDateOfBirth,
    required this.showPhoneNumber,
    required this.showGender,
    required this.onToggleShowDateOfBirth,
    required this.onToggleShowPhoneNumber,
    required this.onToggleShowGender,
    required this.onToggleEdit,
    required this.onSave,
    required this.onUploadAvatar,
    required this.onGenderChange,
    required this.onPickDate,
    required this.userId,
    required this.currentUserId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (profile == null) {
      return const SizedBox(
        height: 200,
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final u = profile!;
    final coverUrl = u.coverPhoto != null
        ? (u.coverPhoto!.startsWith('http') ? u.coverPhoto! : '${DioClient.chatBaseUrl}${u.coverPhoto}')
        : null;
    final avatarUrl = u.avatarUrl != null
        ? (u.avatarUrl!.startsWith('http') ? u.avatarUrl! : '${DioClient.chatBaseUrl}${u.avatarUrl}')
        : null;

    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Cover + Avatar
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                height: 120,
                decoration: BoxDecoration(
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(20)),
                  color: AppTheme.ponCyan.withValues(alpha: 0.2),
                  image: coverUrl != null
                      ? DecorationImage(
                          image: CachedNetworkImageProvider(coverUrl),
                          fit: BoxFit.cover)
                      : null,
                ),
              ),
              Positioned(
                bottom: -36,
                left: 0,
                right: 0,
                child: Center(
                  child: Stack(
                    children: [
                      CircleAvatar(
                        radius: 40,
                        backgroundImage:
                            avatarUrl != null ? CachedNetworkImageProvider(avatarUrl) : null,
                        backgroundColor: AppTheme.ponCyan.withValues(alpha: 0.3),
                        child: avatarUrl == null
                            ? Text(
                                u.displayName.isNotEmpty ? u.displayName[0].toUpperCase() : '?',
                                style: const TextStyle(fontSize: 28, color: Colors.white),
                              )
                            : null,
                      ),
                      if (isSelf)
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: GestureDetector(
                            onTap: onUploadAvatar,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: AppTheme.ponCyan,
                                shape: BoxShape.circle,
                                border: Border.all(color: AppTheme.darkSurface, width: 2),
                              ),
                              child: const Icon(Icons.camera_alt, size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 48),
          // Name
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: editMode
                ? TextField(
                    controller: nameCtrl,
                    decoration:
                        InputDecoration(labelText: context.l10n.profileNameLabel),
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  )
                : Text(
                    u.displayName,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
          ),
          const SizedBox(height: 12),
          // Privacy section header (self edit mode only).
          if (isSelf && editMode)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  context.l10n.profilePrivacySection,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.white60,
                  ),
                ),
              ),
            ),
          // Personal info section with per-field privacy gating + edit toggles.
          ProfilePersonalInfo(
            u: u,
            isSelf: isSelf,
            editMode: editMode,
            bioCtrl: bioCtrl,
            phoneCtrl: phoneCtrl,
            gender: gender,
            dob: dob,
            onGenderChange: onGenderChange,
            onPickDate: onPickDate,
            showDateOfBirth: showDateOfBirth,
            showPhoneNumber: showPhoneNumber,
            showGender: showGender,
            onToggleShowDateOfBirth: onToggleShowDateOfBirth,
            onToggleShowPhoneNumber: onToggleShowPhoneNumber,
            onToggleShowGender: onToggleShowGender,
          ),
          const Divider(height: 8),
          // Actions
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            child: isSelf
                ? Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: Icon(editMode ? Icons.close : Icons.edit_outlined, size: 16),
                          label: Text(editMode ? context.l10n.actionCancel : context.l10n.profileEditMode),
                          onPressed: onToggleEdit,
                        ),
                      ),
                      if (editMode) ...[
                        const SizedBox(width: 8),
                        Expanded(
                          child: FilledButton.icon(
                            icon: saving
                                ? const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.check, size: 16),
                            label: Text(context.l10n.profileSave),
                            onPressed: saving ? null : onSave,
                            style: FilledButton.styleFrom(backgroundColor: AppTheme.ponCyan),
                          ),
                        ),
                      ],
                    ],
                  )
                : OtherUserActions(
                    userId: userId,
                    currentUserId: currentUserId,
                    isDark: isDark,
                  ),
          ),
        ],
      ),
    );
  }
}
