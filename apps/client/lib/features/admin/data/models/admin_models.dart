import 'package:flutter/foundation.dart';

/// Canonical capability keys (mirror of @platform/database `Capability` and the
/// web `CAPABILITIES` union). Kept as raw strings since the backend embeds them
/// verbatim in the JWT `perms` claim and the /me/capabilities response.
abstract class Cap {
  static const manageWorkspace = 'MANAGE_WORKSPACE';
  static const manageDepartments = 'MANAGE_DEPARTMENTS';
  static const manageMembers = 'MANAGE_MEMBERS';
  static const manageRoles = 'MANAGE_ROLES';
  static const connectWorkspaceConnector = 'CONNECT_WORKSPACE_CONNECTOR';
  static const addCustomMcp = 'ADD_CUSTOM_MCP';
  static const connectPersonalConnector = 'CONNECT_PERSONAL_CONNECTOR';
  static const usePersonalAssistant = 'USE_PERSONAL_ASSISTANT';
  static const useGroupBot = 'USE_GROUP_BOT';
  static const runSensitiveSkill = 'RUN_SENSITIVE_SKILL';
  static const viewAuditLog = 'VIEW_AUDIT_LOG';

  /// Every capability key, in the canonical order used by the roles matrix.
  static const all = <String>[
    manageWorkspace,
    manageDepartments,
    manageMembers,
    manageRoles,
    connectWorkspaceConnector,
    addCustomMcp,
    connectPersonalConnector,
    usePersonalAssistant,
    useGroupBot,
    runSensitiveSkill,
    viewAuditLog,
  ];

  /// Capabilities that grant access to at least one admin console section.
  static const adminSections = <String>[
    manageWorkspace,
    manageDepartments,
    manageMembers,
    manageRoles,
    viewAuditLog,
  ];
}

/// A role's permission matrix: capability key -> enabled flag (absent = off).
typedef PermissionMatrix = Map<String, bool>;

/// Public workspace config returned alongside capabilities.
@immutable
class WorkspacePublicConfig {
  final String name;
  final Map<String, bool> features;
  final List<String> connectorAllowList;

  const WorkspacePublicConfig({
    required this.name,
    required this.features,
    required this.connectorAllowList,
  });

  factory WorkspacePublicConfig.fromJson(Map<String, dynamic> json) =>
      WorkspacePublicConfig(
        name: json['name'] as String? ?? '',
        features: _boolMap(json['features']),
        connectorAllowList: _stringList(json['connectorAllowList']),
      );
}

/// `GET /me/capabilities` — resolved RBAC claims + workspace config.
@immutable
class MeCapabilities {
  final String role;
  final List<String> perms;
  final List<String> depts;
  final WorkspacePublicConfig workspace;

  const MeCapabilities({
    required this.role,
    required this.perms,
    required this.depts,
    required this.workspace,
  });

  factory MeCapabilities.fromJson(Map<String, dynamic> json) => MeCapabilities(
        role: json['role'] as String? ?? 'Member',
        perms: _stringList(json['perms']),
        depts: _stringList(json['depts']),
        workspace: WorkspacePublicConfig.fromJson(
          (json['workspace'] as Map<String, dynamic>?) ?? const {},
        ),
      );

  bool has(String cap) => perms.contains(cap);

  /// True if the caller can see the admin area at all.
  bool get canAccessAdmin => Cap.adminSections.any(perms.contains);
}

/// `GET /admin/workspace` — the singleton workspace document (admin view).
@immutable
class Workspace {
  final String id;
  final String name;
  final String? logoUrl;
  final String? primaryColor;
  final Map<String, bool> features;
  final List<String> connectorAllowList;

  const Workspace({
    required this.id,
    required this.name,
    this.logoUrl,
    this.primaryColor,
    required this.features,
    required this.connectorAllowList,
  });

  factory Workspace.fromJson(Map<String, dynamic> json) => Workspace(
        id: json['_id'] as String? ?? json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        logoUrl: json['logoUrl'] as String?,
        primaryColor: json['primaryColor'] as String?,
        features: _boolMap(json['features']),
        connectorAllowList: _stringList(json['connectorAllowList']),
      );
}

/// `GET /admin/departments` item.
@immutable
class Department {
  final String id;
  final String name;
  final String? description;
  final String? leadUserId;

  const Department({
    required this.id,
    required this.name,
    this.description,
    this.leadUserId,
  });

  factory Department.fromJson(Map<String, dynamic> json) => Department(
        id: json['_id'] as String? ?? json['id'] as String,
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        leadUserId: json['leadUserId']?.toString(),
      );
}

/// `GET /admin/members` item (projection: no secrets).
@immutable
class Member {
  final String id;
  final String displayName;
  final String email;
  final String? avatarUrl;
  final String? roleId;
  final List<String> departmentIds;

  const Member({
    required this.id,
    required this.displayName,
    required this.email,
    this.avatarUrl,
    this.roleId,
    required this.departmentIds,
  });

  factory Member.fromJson(Map<String, dynamic> json) => Member(
        id: json['_id'] as String? ?? json['id'] as String,
        displayName: json['displayName'] as String? ?? '',
        email: json['email'] as String? ?? '',
        avatarUrl: json['avatarUrl'] as String?,
        roleId: json['roleId']?.toString(),
        departmentIds: _stringList(json['departmentIds']),
      );
}

/// `GET /admin/roles` item.
@immutable
class Role {
  final String id;
  final String name;
  final bool isPreset;
  final PermissionMatrix permissions;

  const Role({
    required this.id,
    required this.name,
    required this.isPreset,
    required this.permissions,
  });

  bool get isOwner => name == 'Owner';

  factory Role.fromJson(Map<String, dynamic> json) => Role(
        id: json['_id'] as String? ?? json['id'] as String,
        name: json['name'] as String? ?? '',
        isPreset: json['isPreset'] as bool? ?? false,
        permissions: _boolMap(json['permissions']),
      );
}

/// `GET /admin/audit` item.
@immutable
class AuditLogEntry {
  final String id;
  final String actorId;
  final String? actorName;
  final String action;
  final String targetType;
  final String? targetId;
  final DateTime? createdAt;

  const AuditLogEntry({
    required this.id,
    required this.actorId,
    this.actorName,
    required this.action,
    required this.targetType,
    this.targetId,
    this.createdAt,
  });

  factory AuditLogEntry.fromJson(Map<String, dynamic> json) => AuditLogEntry(
        id: json['id'] as String? ?? json['_id'] as String? ?? '',
        actorId: json['actorId'] as String? ?? '',
        actorName: json['actorName'] as String?,
        action: json['action'] as String? ?? '',
        targetType: json['targetType'] as String? ?? '',
        targetId: json['targetId']?.toString(),
        createdAt: json['createdAt'] == null
            ? null
            : DateTime.tryParse(json['createdAt'].toString()),
      );
}

/// `GET /admin/audit` paginated response.
@immutable
class AuditListResult {
  final List<AuditLogEntry> items;
  final int total;
  final int page;
  final int limit;

  const AuditListResult({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
  });

  factory AuditListResult.fromJson(Map<String, dynamic> json) => AuditListResult(
        items: (json['items'] as List<dynamic>? ?? const [])
            .map((e) => AuditLogEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: json['total'] as int? ?? 0,
        page: json['page'] as int? ?? 0,
        limit: json['limit'] as int? ?? 20,
      );
}

// ── parsing helpers ──────────────────────────────────────────────────────────
List<String> _stringList(dynamic raw) =>
    (raw as List<dynamic>? ?? const []).map((e) => e.toString()).toList();

Map<String, bool> _boolMap(dynamic raw) {
  final map = raw as Map<String, dynamic>? ?? const {};
  return map.map((k, v) => MapEntry(k, v == true));
}
