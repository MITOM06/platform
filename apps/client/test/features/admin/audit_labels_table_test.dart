// Every audit action / target type has its own localized label, and the
// timestamp is formatted for the locale.

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:platform_client/features/admin/data/models/admin_models.dart';
import 'package:platform_client/features/admin/utils/audit_labels.dart';
import 'package:platform_client/l10n/app_localizations.dart';

void main() {
  final l = lookupAppLocalizations(const Locale('en'));

  test('every known audit action maps to its own label', () {
    final expected = <String, String>{
      'workspace.update': l.adminAuditActionWorkspaceUpdate,
      'department.create': l.adminAuditActionDepartmentCreate,
      'department.update': l.adminAuditActionDepartmentUpdate,
      'department.delete': l.adminAuditActionDepartmentDelete,
      'member.update': l.adminAuditActionMemberUpdate,
      'member.sso_update': l.adminAuditActionMemberSsoUpdate,
      'member.ai_context_update': l.adminAuditActionMemberAiContextUpdate,
      'member.block': l.adminAuditActionMemberBlock,
      'member.unblock': l.adminAuditActionMemberUnblock,
      'role.create': l.adminAuditActionRoleCreate,
      'role.update': l.adminAuditActionRoleUpdate,
      'role.delete': l.adminAuditActionRoleDelete,
      'invitation.create': l.adminAuditActionInvitationCreate,
      'invitation.resend': l.adminAuditActionInvitationResend,
      'invitation.revoke': l.adminAuditActionInvitationRevoke,
      'invitation.accept': l.adminAuditActionInvitationAccept,
      'connector.connect': l.adminAuditActionConnectorConnect,
      'connector.disconnect': l.adminAuditActionConnectorDisconnect,
      'connector.replace': l.adminAuditActionConnectorReplace,
      'connection.permissions.update':
          l.adminAuditActionConnectionPermissionsUpdate,
      'custom_mcp.add': l.adminAuditActionCustomMcpAdd,
      'custom_mcp.delete': l.adminAuditActionCustomMcpDelete,
      'directory.create': l.adminAuditActionDirectoryCreate,
      'directory.update': l.adminAuditActionDirectoryUpdate,
      'directory.delete': l.adminAuditActionDirectoryDelete,
      'sensitive_skill.run': l.adminAuditActionSensitiveSkillRun,
    };
    for (final e in expected.entries) {
      expect(auditActionLabel(l, e.key), e.value, reason: e.key);
    }
    // Distinct labels: a copy/paste mapping two actions to one label fails.
    expect(expected.values.toSet().length, expected.length);
  });

  test('unnamed targets get the label of their type', () {
    AuditLogEntry target(String type) => AuditLogEntry(
          id: 'a',
          actorId: 'u',
          action: 'x',
          targetType: type,
          targetId: '64b7f0c2a1b2c3d4e5f60719',
        );
    final expected = <String, String>{
      'workspace': l.adminAuditTargetWorkspace,
      'member': l.adminAuditTargetMember,
      'role': l.adminAuditTargetRole,
      'department': l.adminAuditTargetDepartment,
      'invitation': l.adminAuditTargetInvitation,
      'connector': l.adminAuditTargetConnector,
      'directory_entry': l.adminAuditTargetDirectoryEntry,
      'tool': l.adminAuditTargetTool,
      'weird': l.adminAuditTargetOther,
    };
    for (final e in expected.entries) {
      expect(auditTargetLabel(l, target(e.key)), e.value, reason: e.key);
    }
  });

  test('auditTimeLabel formats in the locale (local time)', () async {
    await initializeDateFormatting('en');
    final when = DateTime.utc(2026, 10, 5, 15, 4).toLocal();
    final s = auditTimeLabel(l, when.toUtc());
    expect(s, contains('2026'));
    expect(s, contains('Oct'));
    expect(s, contains(when.minute.toString().padLeft(2, '0')));
  });
}
