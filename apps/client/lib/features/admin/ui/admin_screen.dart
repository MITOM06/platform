import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../data/models/admin_models.dart';
import '../state/capabilities_provider.dart';
import 'widgets/audit_panel.dart';
import 'widgets/departments_panel.dart';
import 'widgets/members_panel.dart';
import 'widgets/roles_panel.dart';
import 'widgets/sso_panel.dart';
import 'widgets/workspace_ai_settings_panel.dart';
import 'widgets/workspace_panel.dart';

class _Section {
  final String cap;
  final IconData icon;
  final String Function(BuildContext) label;
  final Widget panel;
  const _Section(this.cap, this.icon, this.label, this.panel);
}

/// Enterprise admin console — mirrors the web `/admin` route group. Section tabs
/// are filtered by the caller's capabilities; if the caller has no admin
/// capability at all we bounce home (defence-in-depth on top of backend gates).
class AdminScreen extends ConsumerStatefulWidget {
  const AdminScreen({super.key});

  @override
  ConsumerState<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends ConsumerState<AdminScreen> {
  int _index = 0;

  List<_Section> _sections() => [
        _Section(Cap.manageWorkspace, Icons.business_outlined,
            (c) => c.l10n.adminNavWorkspace, const WorkspacePanel()),
        _Section(Cap.manageWorkspace, Icons.auto_awesome,
            (c) => c.l10n.adminNavAi, const WorkspaceAiSettingsPanel()),
        _Section(Cap.manageWorkspace, Icons.vpn_key_outlined,
            (c) => c.l10n.adminNavSso, const SsoPanel()),
        _Section(Cap.manageDepartments, Icons.groups_outlined,
            (c) => c.l10n.adminNavDepartments, const DepartmentsPanel()),
        _Section(Cap.manageMembers, Icons.people_outline,
            (c) => c.l10n.adminNavMembers, const MembersPanel()),
        _Section(Cap.manageRoles, Icons.shield_outlined,
            (c) => c.l10n.adminNavRoles, const RolesPanel()),
        _Section(Cap.viewAuditLog, Icons.fact_check_outlined,
            (c) => c.l10n.adminNavAudit, const AuditPanel()),
      ];

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final capsAsync = ref.watch(capabilitiesProvider);

    return Scaffold(
      backgroundColor: AppTheme.darkBackground,
      appBar: AppBar(
        backgroundColor: AppTheme.darkBackground,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(l10n.adminTitle,
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: capsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text('$e',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.6))),
        ),
        data: (caps) {
          if (!caps.canAccessAdmin) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) context.go('/');
            });
            return const SizedBox.shrink();
          }
          final visible =
              _sections().where((s) => caps.has(s.cap)).toList();
          if (visible.isEmpty) return const SizedBox.shrink();
          final safeIndex = _index.clamp(0, visible.length - 1);

          return Column(
            children: [
              _SubNav(
                sections: visible,
                selected: safeIndex,
                onSelect: (i) => setState(() => _index = i),
              ),
              Expanded(child: visible[safeIndex].panel),
            ],
          );
        },
      ),
    );
  }
}

class _SubNav extends StatelessWidget {
  final List<_Section> sections;
  final int selected;
  final ValueChanged<int> onSelect;
  const _SubNav({
    required this.sections,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          for (var i = 0; i < sections.length; i++)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _Chip(
                icon: sections[i].icon,
                label: sections[i].label(context),
                active: i == selected,
                onTap: () => onSelect(i),
              ),
            ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _Chip({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active
              ? AppTheme.ponCyan.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: active ? AppTheme.ponCyan : AppTheme.darkBorder,
          ),
        ),
        child: Row(
          children: [
            Icon(icon,
                size: 16, color: active ? AppTheme.ponCyan : Colors.white60),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    color: active ? AppTheme.ponCyan : Colors.white60,
                    fontWeight: active ? FontWeight.w600 : FontWeight.normal)),
          ],
        ),
      ),
    );
  }
}
