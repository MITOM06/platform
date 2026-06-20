import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/global_messenger.dart';
import '../../../../core/widgets/pon_widgets.dart';
import '../../data/models/admin_models.dart';
import '../../state/admin_providers.dart';
import 'cap_label.dart';

const _capColWidth = 180.0;
const _roleColWidth = 132.0;

/// Roles & permissions matrix — Capability × role grid. Owner is read-only;
/// presets can be cloned. Mirrors the web `RolesPanel`.
class RolesPanel extends ConsumerStatefulWidget {
  const RolesPanel({super.key});

  @override
  ConsumerState<RolesPanel> createState() => _RolesPanelState();
}

class _RolesPanelState extends ConsumerState<RolesPanel> {
  /// roleId -> edited permission matrix. Seeded from the server roles.
  final Map<String, Map<String, bool>> _edited = {};
  String _seedSig = '';

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
    } catch (_) {
      showErrorSnackBar(l10n.adminToastError);
    }
  }

  Future<void> _clone(Role r) async {
    final l10n = context.l10n;
    final ctrl = TextEditingController(text: '${r.name} copy');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.darkSurface,
        title: Text(l10n.adminRoleCloneTitle(r.name),
            style: const TextStyle(color: Colors.white)),
        content: PonTextField(
          controller: ctrl,
          labelText: l10n.adminRoleName,
          prefixIcon: Icons.shield_outlined,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.adminCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.adminRoleClone,
                style: const TextStyle(color: AppTheme.ponCyan)),
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
    } catch (_) {
      showErrorSnackBar(l10n.adminToastError);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final async = ref.watch(rolesProvider);

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Text('$e',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.6))),
      ),
      data: (roles) {
        _seed(roles);
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Text(l10n.adminRoleHint,
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.55),
                    fontSize: 13)),
            const SizedBox(height: 16),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _headerRow(roles, l10n),
                  const Divider(color: AppTheme.darkBorder, height: 1),
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
    return Row(
      children: [
        SizedBox(
          width: _capColWidth,
          child: Text(l10n.adminRoleCapability,
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.bold)),
        ),
        ...roles.map((r) => SizedBox(
              width: _roleColWidth,
              child: Column(
                children: [
                  Text(r.name,
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w600),
                      overflow: TextOverflow.ellipsis),
                  if (r.isPreset)
                    Text(l10n.adminRolePreset,
                        style: const TextStyle(
                            color: AppTheme.ponPeach, fontSize: 10)),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(Icons.copy_outlined,
                            size: 16, color: Colors.white54),
                        tooltip: l10n.adminRoleClone,
                        onPressed: () => _clone(r),
                      ),
                      if (!r.isOwner)
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          icon: Icon(Icons.save_outlined,
                              size: 16,
                              color: _isDirty(r)
                                  ? AppTheme.ponCyan
                                  : Colors.white24),
                          tooltip: l10n.adminSave,
                          onPressed: _isDirty(r) ? () => _save(r) : null,
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
                style: const TextStyle(color: Colors.white70, fontSize: 13)),
          ),
          ...roles.map((r) {
            final readOnly = r.isOwner;
            final checked =
                readOnly ? true : (_edited[r.id]?[cap] ?? false);
            return SizedBox(
              width: _roleColWidth,
              child: Center(
                child: Checkbox(
                  activeColor: AppTheme.ponCyan,
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
