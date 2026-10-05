import 'package:intl/intl.dart';

import '../../../l10n/app_localizations.dart';
import '../../chat/domain/conversations_realtime_handlers.dart'
    show looksLikeRawId;
import '../data/models/admin_models.dart';

/// Humanized audit-log rows (HANDOFF §5.1), mirroring the web
/// `lib/admin/audit-labels.ts`: actions are localized labels instead of
/// `member.update` codes, the `system` actor is "System", and targets use the
/// server's `targetName` — never a raw id, slug or code.

/// Localized label of an audit [action]; unknown actions get a generic label.
String auditActionLabel(AppLocalizations l, String action) {
  switch (action) {
    case 'workspace.update':
      return l.adminAuditActionWorkspaceUpdate;
    case 'department.create':
      return l.adminAuditActionDepartmentCreate;
    case 'department.update':
      return l.adminAuditActionDepartmentUpdate;
    case 'department.delete':
      return l.adminAuditActionDepartmentDelete;
    case 'member.update':
      return l.adminAuditActionMemberUpdate;
    case 'member.sso_update':
      return l.adminAuditActionMemberSsoUpdate;
    case 'member.block':
      return l.adminAuditActionMemberBlock;
    case 'member.unblock':
      return l.adminAuditActionMemberUnblock;
    case 'role.create':
      return l.adminAuditActionRoleCreate;
    case 'role.update':
      return l.adminAuditActionRoleUpdate;
    case 'invitation.create':
      return l.adminAuditActionInvitationCreate;
    case 'invitation.resend':
      return l.adminAuditActionInvitationResend;
    case 'invitation.revoke':
      return l.adminAuditActionInvitationRevoke;
    case 'invitation.accept':
      return l.adminAuditActionInvitationAccept;
    case 'connector.connect':
      return l.adminAuditActionConnectorConnect;
    case 'connector.disconnect':
      return l.adminAuditActionConnectorDisconnect;
    case 'connector.replace':
      return l.adminAuditActionConnectorReplace;
    case 'connection.permissions.update':
      return l.adminAuditActionConnectionPermissionsUpdate;
    case 'custom_mcp.add':
      return l.adminAuditActionCustomMcpAdd;
    case 'custom_mcp.delete':
      return l.adminAuditActionCustomMcpDelete;
    case 'directory.create':
      return l.adminAuditActionDirectoryCreate;
    case 'directory.update':
      return l.adminAuditActionDirectoryUpdate;
    case 'directory.delete':
      return l.adminAuditActionDirectoryDelete;
    case 'sensitive_skill.run':
      return l.adminAuditActionSensitiveSkillRun;
    default:
      return l.adminAuditActionOther;
  }
}

/// Who did it: "System" for automated actions, the actor's name, or
/// "A former member" when the name is missing or is itself an id.
String auditActorLabel(AppLocalizations l, AuditLogEntry e) {
  if (e.actorId == 'system') return l.adminAuditSystem;
  return _safeName(e.actorName, e.actorId) ?? l.adminAuditFormerMember;
}

/// What it was done to: the server's `targetName`, else a generic label for
/// the target type.
String auditTargetLabel(AppLocalizations l, AuditLogEntry e) {
  final named = _safeName(e.targetName, e.targetId);
  if (named != null) return named;
  switch (e.targetType) {
    case 'workspace':
      return l.adminAuditTargetWorkspace;
    case 'member':
      return l.adminAuditTargetMember;
    case 'role':
      return l.adminAuditTargetRole;
    case 'department':
      return l.adminAuditTargetDepartment;
    case 'invitation':
      return l.adminAuditTargetInvitation;
    case 'connector':
      return l.adminAuditTargetConnector;
    case 'directory_entry':
      return l.adminAuditTargetDirectoryEntry;
    case 'tool':
      return l.adminAuditTargetTool;
    default:
      return l.adminAuditTargetOther;
  }
}

/// Locale-aware timestamp ("Oct 5, 2026 3:04 PM" / "5 thg 10, 2026 15:04").
String auditTimeLabel(AppLocalizations l, DateTime when) =>
    DateFormat.yMMMd(l.localeName).add_jm().format(when.toLocal());

String? _safeName(String? name, String? id) {
  final trimmed = name?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  if (id != null && trimmed == id) return null;
  if (looksLikeRawId(trimmed) || trimmed.startsWith('mcp__')) return null;
  return trimmed;
}
