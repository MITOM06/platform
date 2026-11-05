import 'dart:convert';
import '../../../../core/utils/app_error.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/admin_models.dart';
import '../../state/admin_providers.dart';
import '../../state/capabilities_provider.dart';
import '../../utils/admin_error.dart';
import '../../utils/role_guard.dart';
import 'admin_confirm_dialog.dart';
import 'cap_label.dart';

const _capColWidth = 180.0;
const _roleColWidth = 132.0;

/// Roles & permissions matrix — Capability × role grid. Owner is read-only;
/// presets can be cloned; a custom role nobody uses can be deleted. Mirrors the
/// web `RolesPanel`.
class RolesPanel extends ConsumerStatefulWidget {
  const RolesPanel({super.key});

  @override
  ConsumerState<RolesPanel> createState() => _RolesPanelState();
}

class _RolesPanelState extends ConsumerState<RolesPanel> {
  /// roleId -> edited permission matrix. Seeded from the server roles.
  final Map<String, Map<String, bool>> _edited = {};
  String _seedSig = '';
  bool _deleting = false;

  void _seed(List<Role> roles) {
    final sig = roles.map((r) => r.id).join(',');
    if (sig == _seedSig) return;
    _seedSig = sig;
    _edited.clear();
    for (final r in roles) {
      _edited[r.id] = Map<String, bool>.from(r.permissions);
    }
  }

  bool _isDirty(Role r) =>
      jsonEncode(_edited[r.id] ?? {}) != jsonEncode(r.permissions);

  Future<void> _save(Role r) async {
    final l10n = context.l10n;
    try {
      await ref
          .read(rolesProvider.notifier)
          .edit(r.id, {'permissions': _edited[r.id]});
      showInfoSnackBar(l10n.adminToastSaved);
    } catch (e) {
      // ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS / CANNOT_EDIT_OWN_ROLE / … → their
      // own localized message (HANDOFF §5.1).
      showErrorSnackBar(
          mounted ? adminErrorMessage(context, e) : l10n.adminToastError);
    }
  }

  Future<void> _clone(Role r) async {
    final l10n = context.l10n;
    final ctrl =
        TextEditingController(text: l10n.adminRoleCloneDefaultName(r.name));
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.adminRoleCloneTitle(r.name),
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),
        content: PonTextField(
          controller: ctrl,
          labelText: l10n.adminRoleName,
          prefixIcon: Icons.shield_rounded,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.adminCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.adminRoleClone,
                style: TextStyle(color: AppTheme.accent(context))),
          ),
        ],
      ),
    );
    if (ok != true || ctrl.text.trim().isEmpty) return;
    try {
      await ref.read(rolesProvider.notifier).create({
        'name': ctrl.text.trim(),
        'permissions': Map<String, bool>.from(r.permissions),
      });
      showInfoSnackBar(l10n.adminToastSaved);
    } catch (e) {
      showErrorSnackBar(
          mounted ? adminErrorMessage(context, e) : l10n.adminToastError);
    }
  }

  Future<void> _delete(Role r) async {
    final l10n = context.l10n;
    final ok = await confirmAdminAction(
      context,
      message: l10n.adminRoleDeleteConfirm(r.name),
      confirmLabel: l10n.adminRoleDelete,
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _deleting = true);
    try {
      await ref.read(rolesProvider.notifier).remove(r.id);
      showInfoSnackBar(l10n.adminToastDeleted);
    } catch (e) {
      // ROLE_IN_USE (with counts) / PRESET_ROLE_DELETE_FORBIDDEN / … → their
      // own localized message.
      showErrorSnackBar(
          mounted ? adminErrorMessage(context, e) : l10n.adminToastError);
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final async = ref.watch(rolesProvider);

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Text(friendlyError(e),
            style: TextStyle(color: AppTheme.mutedText(context))),
      ),
      data: (roles) {
        _seed(roles);
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Text(l10n.adminRoleHint,
                style: TextStyle(
                    color: AppTheme.mutedText(context),
                    fontSize: 12)),
            const SizedBox(height: 16),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _headerRow(roles, l10n),
                  Divider(color: AppTheme.hairline(context), height: 1),
                  ...Cap.all.map((cap) => _capRow(cap, roles)),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _headerRow(List<Role> roles, l10n) {
    final caps = ref.watch(capabilitiesProvider).valueOrNull;
    bool deletable(Role r) =>
        caps != null &&
        canDeleteRole(role: r, callerRole: caps.role, callerPerms: caps.perms);
    return Row(
      children: [
        SizedBox(
          width: _capColWidth,
          child: Text(l10n.adminRoleCapability,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600)),
        ),
        ...roles.map((r) => SizedBox(
              width: _roleColWidth,
              child: Column(
                children: [
                  Text(r.name,
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface, fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis),
                  if (r.isPreset)
                    Text(l10n.adminRolePreset,
                        style: TextStyle(
                            color: AppTheme.accent(context), fontSize: 10)),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        icon: Icon(Icons.copy_rounded,
                            size: 16, color: AppTheme.mutedText(context)),
                        tooltip: l10n.adminRoleClone,
                        onPressed: () => _clone(r),
                      ),
                      if (!r.isOwner)
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          icon: Icon(Icons.save_rounded,
                              size: 16,
                              color: _isDirty(r)
                                  ? AppTheme.accent(context)
                                  : AppTheme.hairline(context)),
                          tooltip: l10n.adminSave,
                          onPressed: _isDirty(r) ? () => _save(r) : null,
                        ),
                      if (!r.isPreset)
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          icon: Icon(Icons.delete_outline_rounded,
                              size: 16,
                              color: deletable(r) && !_deleting
                                  ? Theme.of(context).colorScheme.error
                                  : AppTheme.hairline(context)),
                          tooltip: l10n.adminRoleDelete,
                          onPressed: deletable(r) && !_deleting
                              ? () => _delete(r)
                              : null,
                        ),
                    ],
                  ),
                ],
              ),
            )),
      ],
    );
  }

  Widget _capRow(String cap, List<Role> roles) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: _capColWidth,
            child: Text(capabilityLabel(context, cap),
                style: TextStyle(color: AppTheme.mutedText(context), fontSize: 12)),
          ),
          ...roles.map((r) {
            final readOnly = r.isOwner;
            final checked =
                readOnly ? true : (_edited[r.id]?[cap] ?? false);
            return SizedBox(
              width: _roleColWidth,
              child: Center(
                child: Checkbox(
                  activeColor: AppTheme.accent(context),
                  value: checked,
                  onChanged: readOnly
                      ? null
                      : (v) => setState(
                          () => _edited[r.id]![cap] = v ?? false),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
