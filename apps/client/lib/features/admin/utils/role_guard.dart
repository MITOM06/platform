import '../data/models/admin_models.dart';

/// Why a member's role can't be changed from the members panel. Mirrors the
/// server guard on `PATCH /admin/members/:id` (CANNOT_CHANGE_OWN_ROLE /
/// OWNER_ROLE_ASSIGN_FORBIDDEN) so the UI never offers a change the server
/// would reject. Mirror of web `lib/admin/role-guard.ts`.
enum MemberRoleLock { self, owner }

/// `null` when the caller may change [target]'s role.
MemberRoleLock? memberRoleLock({
  required bool isSelf,
  required bool targetIsOwner,
  required bool callerIsOwner,
}) {
  if (isSelf) return MemberRoleLock.self;
  if (targetIsOwner && !callerIsOwner) return MemberRoleLock.owner;
  return null;
}

/// Roles the caller may grant: the Owner role only when the caller is Owner.
List<Role> assignableRoles(List<Role> roles, {required bool callerIsOwner}) =>
    callerIsOwner ? roles : roles.where((r) => !r.isOwner).toList();

/// Whether [role] makes its holder "privileged" for 2FA (contract 09): Owner,
/// Admin, or any role granting workspace / member / role management — so a
/// cloned admin-like role can't skip it. Mirror of the server rule.
bool isPrivilegedRole(Role? role) {
  if (role == null) return false;
  if (role.isOwner || role.name == 'Admin') return true;
  return role.permissions[Cap.manageWorkspace] == true ||
      role.permissions[Cap.manageMembers] == true ||
      role.permissions[Cap.manageRoles] == true;
}

/// "Reset 2FA" is offered only to an Owner, never on their own row (the server
/// answers `MFA_RESET_FORBIDDEN` / `MFA_RESET_SELF_FORBIDDEN`), and only on a
/// member it means something for: enrolled, or privileged.
bool canResetMemberMfa({
  required bool isSelf,
  required bool callerIsOwner,
  required bool targetMfaEnabled,
  required bool targetPrivileged,
}) =>
    callerIsOwner && !isSelf && (targetMfaEnabled || targetPrivileged);
