import 'package:flutter/material.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/models/admin_models.dart';
import '../../utils/role_guard.dart';

/// What the admin saved in [MemberEditDialog]. [roleId] is `null` when the role
/// must not be sent (locked row, or "no role" picked) — only departments change.
class MemberEditResult {
  final String? roleId;
  final List<String> departmentIds;
  const MemberEditResult({required this.roleId, required this.departmentIds});
}

/// Edit a member's role + departments. Mirrors the web `MembersPanel` edit
/// modal: the role picker is read-only on the caller's own row and (for
/// non-Owners) on an Owner's row; the Owner option is offered to Owners only.
class MemberEditDialog extends StatefulWidget {
  final Member member;
  final List<Role> roles;
  final List<Department> departments;
  final bool canRoles;
  final bool canDepts;
  final bool callerIsOwner;
  final MemberRoleLock? roleLock;

  const MemberEditDialog({
    super.key,
    required this.member,
    required this.roles,
    required this.departments,
    required this.canRoles,
    required this.canDepts,
    required this.callerIsOwner,
    required this.roleLock,
  });

  static Future<MemberEditResult?> show(
    BuildContext context, {
    required Member member,
    required List<Role> roles,
    required List<Department> departments,
    required bool canRoles,
    required bool canDepts,
    required bool callerIsOwner,
    required MemberRoleLock? roleLock,
  }) =>
      showDialog<MemberEditResult>(
        context: context,
        builder: (_) => MemberEditDialog(
          member: member,
          roles: roles,
          departments: departments,
          canRoles: canRoles,
          canDepts: canDepts,
          callerIsOwner: callerIsOwner,
          roleLock: roleLock,
        ),
      );

  @override
  State<MemberEditDialog> createState() => _MemberEditDialogState();
}

class _MemberEditDialogState extends State<MemberEditDialog> {
  late final List<Role> _options;
  String? _roleId;
  late final Set<String> _selected;

  bool get _locked => widget.roleLock != null;

  @override
  void initState() {
    super.initState();
    // A locked picker still lists every role so the current one (maybe Owner)
    // renders; an open one hides Owner from non-Owners.
    _options = _locked
        ? widget.roles
        : assignableRoles(widget.roles, callerIsOwner: widget.callerIsOwner);
    final current = widget.member.roleId;
    // The dropdown requires its value among the items (a deleted role isn't).
    _roleId = _options.any((r) => r.id == current) ? current : null;
    _selected = {...widget.member.departmentIds};
  }

  void _toggleDept(String id) => setState(() {
        if (!_selected.remove(id)) _selected.add(id);
      });

  void _save() => Navigator.pop(
        context,
        MemberEditResult(
          roleId: _locked ? null : _roleId,
          departmentIds: _selected.toList(),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final muted = AppTheme.mutedText(context);
    final lock = widget.roleLock;

    return AlertDialog(
      title: Text(l10n.adminMemberEdit, style: TextStyle(color: onSurface)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${widget.member.displayName} · ${l10n.adminMemberRevokeNote}',
                style: TextStyle(color: muted, fontSize: 12)),
            const SizedBox(height: 12),
            if (widget.canRoles) ...[
              DropdownButtonFormField<String?>(
                key: const ValueKey('member-role-select'),
                initialValue: _roleId,
                isExpanded: true,
                dropdownColor: Theme.of(context).colorScheme.surface,
                style: TextStyle(color: onSurface),
                decoration: InputDecoration(
                  labelText: l10n.adminMemberRole,
                  labelStyle: TextStyle(color: muted),
                ),
                items: [
                  DropdownMenuItem(
                      value: null, child: Text(l10n.adminMemberRoleNone)),
                  ..._options.map((r) => DropdownMenuItem(
                      value: r.id,
                      child: Text(r.name, overflow: TextOverflow.ellipsis))),
                ],
                // null onChanged = disabled (locked row).
                onChanged:
                    _locked ? null : (v) => setState(() => _roleId = v),
              ),
              if (lock != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    lock == MemberRoleLock.self
                        ? l10n.adminMemberRoleLockedSelf
                        : l10n.adminMemberRoleLockedOwner,
                    key: const ValueKey('member-role-locked'),
                    style: TextStyle(color: muted, fontSize: 12),
                  ),
                ),
            ],
            if (widget.canDepts) ...[
              const SizedBox(height: 12),
              Text(l10n.adminMemberDepartments,
                  style: TextStyle(color: muted)),
              if (widget.departments.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child:
                      Text(l10n.adminDeptEmpty, style: TextStyle(color: muted)),
                )
              else
                ...widget.departments.map(
                  (d) => CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    activeColor: AppTheme.ponAccent,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: Text(d.name, style: TextStyle(color: onSurface)),
                    value: _selected.contains(d.id),
                    onChanged: (_) => _toggleDept(d.id),
                  ),
                ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(l10n.adminCancel),
        ),
        TextButton(
          onPressed: _save,
          child: Text(l10n.adminSave,
              style: const TextStyle(color: AppTheme.ponAccent)),
        ),
      ],
    );
  }
}
