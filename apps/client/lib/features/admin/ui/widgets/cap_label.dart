import 'package:flutter/widgets.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../data/models/admin_models.dart';

/// Localized display label for a capability key. Central mapping so the roles
/// matrix and any other surface render capabilities consistently. Falls back to
/// the raw key for any capability not yet localized.
String capabilityLabel(BuildContext context, String cap) {
  final l = context.l10n;
  switch (cap) {
    case Cap.manageWorkspace:
      return l.adminCapManageWorkspace;
    case Cap.manageDepartments:
      return l.adminCapManageDepartments;
    case Cap.manageMembers:
      return l.adminCapManageMembers;
    case Cap.manageRoles:
      return l.adminCapManageRoles;
    case Cap.connectWorkspaceConnector:
      return l.adminCapConnectWorkspaceConnector;
    case Cap.addCustomMcp:
      return l.adminCapAddCustomMcp;
    case Cap.connectPersonalConnector:
      return l.adminCapConnectPersonalConnector;
    case Cap.usePersonalAssistant:
      return l.adminCapUsePersonalAssistant;
    case Cap.useGroupBot:
      return l.adminCapUseGroupBot;
    case Cap.runSensitiveSkill:
      return l.adminCapRunSensitiveSkill;
    case Cap.viewAuditLog:
      return l.adminCapViewAuditLog;
    default:
      return cap;
  }
}
