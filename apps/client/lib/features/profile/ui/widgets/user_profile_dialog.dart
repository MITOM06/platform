import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../../core/api/dio_client.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/auth_provider.dart';
import '../../../auth/domain/auth_state.dart';
import '../../../chat/data/chat_repository.dart';
import '../../../chat/domain/chat_provider.dart';
import '../../../friends/data/friends_repository.dart';
import '../../../friends/domain/friends_provider.dart';

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
          );
      if (mounted) setState(() { _editMode = false; _fieldsInitialized = false; });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
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
          onToggleHideInfo: profile != null && isSelf
              ? (v) => ref
                    .read(authNotifierProvider.notifier)
                    .updateProfile(hideInfo: v)
              : null,
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
  final VoidCallback onToggleEdit;
  final VoidCallback? onSave;
  final VoidCallback onUploadAvatar;
  final ValueChanged<String?> onGenderChange;
  final VoidCallback? onPickDate;
  final ValueChanged<bool>? onToggleHideInfo;
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
    required this.onToggleEdit,
    required this.onSave,
    required this.onUploadAvatar,
    required this.onGenderChange,
    required this.onPickDate,
    required this.onToggleHideInfo,
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
    final hidePersonal = !isSelf && u.hideInfo;

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
                    decoration: const InputDecoration(labelText: 'Name'),
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  )
                : Text(
                    u.displayName,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
          ),
          const SizedBox(height: 12),
          // Personal info section
          if (hidePersonal)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.lock_outline, size: 14, color: Colors.white54),
                  const SizedBox(width: 6),
                  Text(
                    context.l10n.profileInfoHidden,
                    style: const TextStyle(color: Colors.white54, fontSize: 13),
                  ),
                ],
              ),
            )
          else
            _PersonalInfo(
              u: u,
              isSelf: isSelf,
              editMode: editMode,
              bioCtrl: bioCtrl,
              phoneCtrl: phoneCtrl,
              gender: gender,
              dob: dob,
              onGenderChange: onGenderChange,
              onPickDate: onPickDate,
            ),
          // Privacy toggle (self only)
          if (isSelf) ...[
            const Divider(height: 24),
            SwitchListTile(
              value: u.hideInfo,
              onChanged: onToggleHideInfo,
              title: Text(context.l10n.profileHideInfo,
                  style: const TextStyle(fontSize: 14)),
              activeThumbColor: AppTheme.ponCyan,
              dense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 20),
            ),
          ],
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
                : _OtherUserActions(
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

class _PersonalInfo extends StatelessWidget {
  final UserModel u;
  final bool isSelf;
  final bool editMode;
  final TextEditingController bioCtrl;
  final TextEditingController phoneCtrl;
  final String? gender;
  final DateTime? dob;
  final ValueChanged<String?> onGenderChange;
  final VoidCallback? onPickDate;

  const _PersonalInfo({
    required this.u,
    required this.isSelf,
    required this.editMode,
    required this.bioCtrl,
    required this.phoneCtrl,
    required this.gender,
    required this.dob,
    required this.onGenderChange,
    required this.onPickDate,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    if (!editMode) {
      final items = <Widget>[];
      if (u.bio != null && u.bio!.isNotEmpty) {
        items.add(_InfoRow(icon: Icons.info_outline, label: l10n.profileBio, value: u.bio!));
      }
      if (u.gender != null && u.gender!.isNotEmpty) {
        items.add(_InfoRow(icon: Icons.wc_outlined, label: l10n.profileGender, value: u.gender!));
      }
      if (u.dateOfBirth != null) {
        items.add(_InfoRow(
          icon: Icons.cake_outlined,
          label: l10n.profileDateOfBirth,
          value: DateFormat('dd/MM/yyyy').format(u.dateOfBirth!),
        ));
      }
      if (isSelf && u.phoneNumber != null && u.phoneNumber!.isNotEmpty) {
        items.add(_InfoRow(icon: Icons.phone_outlined, label: l10n.profilePhone, value: u.phoneNumber!));
      }
      if (items.isEmpty) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Column(children: items),
      );
    }
    // Edit mode
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: bioCtrl,
            decoration: InputDecoration(labelText: l10n.profileBio),
            maxLines: 2,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: phoneCtrl,
            decoration: InputDecoration(labelText: l10n.profilePhone),
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: gender,
            decoration: InputDecoration(labelText: l10n.profileGender),
            items: const [
              DropdownMenuItem(value: 'male', child: Text('Male')),
              DropdownMenuItem(value: 'female', child: Text('Female')),
              DropdownMenuItem(value: 'other', child: Text('Other')),
            ],
            onChanged: onGenderChange,
          ),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.cake_outlined),
            title: Text(l10n.profileDateOfBirth),
            subtitle: Text(dob != null
                ? DateFormat('dd/MM/yyyy').format(dob!)
                : '—'),
            onTap: onPickDate,
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: Icon(icon, size: 18, color: Colors.white54),
      title: Text(label, style: const TextStyle(fontSize: 11, color: Colors.white54)),
      subtitle: Text(value, style: const TextStyle(fontSize: 13)),
    );
  }
}

class _OtherUserActions extends ConsumerWidget {
  final String userId;
  final String? currentUserId;
  final bool isDark;

  const _OtherUserActions({
    required this.userId,
    required this.currentUserId,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rel = ref.watch(relationshipProvider(userId)).valueOrNull;
    final isFriend = rel?.friendStatus == 'accepted';
    final pending = rel?.friendStatus == 'pending';
    final iBlocked = rel?.iBlocked ?? false;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _ActionChip(
          icon: Icons.message_outlined,
          label: context.l10n.actionMessage,
          onTap: () async {
            Navigator.of(context).pop();
            final conv = await ref
                .read(chatRepositoryProvider)
                .getOrCreateConversation(userId);
            if (context.mounted) context.go('/chat/${conv.id}');
          },
        ),
        if (!isFriend && !pending)
          _ActionChip(
            icon: Icons.person_add_outlined,
            label: context.l10n.actionAddFriend,
            onTap: () async {
              await ref.read(friendsRepositoryProvider).sendRequest(userId);
              ref.invalidate(relationshipProvider(userId));
            },
          ),
        _ActionChip(
          icon: iBlocked ? Icons.lock_open_rounded : Icons.block_rounded,
          label: context.l10n.actionBlock,
          color: Colors.redAccent,
          onTap: () async {
            final repo = ref.read(friendsRepositoryProvider);
            if (iBlocked) {
              await repo.unblockUser(userId);
            } else {
              await repo.blockUser(userId);
            }
            ref.invalidate(relationshipProvider(userId));
          },
        ),
      ],
    );
  }
}

class _ActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;
  final VoidCallback onTap;

  const _ActionChip({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppTheme.ponCyan;
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: c.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: c, size: 20),
          ),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 11, color: c)),
        ],
      ),
    );
  }
}
