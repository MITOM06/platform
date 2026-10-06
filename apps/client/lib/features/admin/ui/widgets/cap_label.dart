import 'package:flutter/widgets.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../../../l10n/app_localizations.dart';
import '../../data/models/admin_models.dart';

/// Localized display label for a capability key. Central mapping so the roles
/// matrix, admin error messages and any other surface render capabilities
/// consistently. An unknown key gets a generic label — never the raw code.
String capabilityLabel(BuildContext context, String cap) =>
    capabilityLabelOf(context.l10n, cap);

/// [capabilityLabel] for context-less callers (error mapping, tests).
String capabilityLabelOf(AppLocalizations l, String cap) {
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
    case Cap.manageAiContext:
      return l.adminCapManageAiContext;
    case Cap.viewInternalContext:
      return l.adminCapViewInternalContext;
    case Cap.viewConfidentialContext:
      return l.adminCapViewConfidentialContext;
    default:
      return l.adminCapUnknown;
  }
}
