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

/// Whether [role] is Owner / Admin-like: Owner, Admin, or any role granting
/// workspace / member / role management (so a cloned admin-like role counts
/// too). Mirror of the server rule used for the 2FA reset authority.
bool isPrivilegedRole(Role? role) {
  if (role == null) return false;
  if (role.isOwner || role.name == 'Admin') return true;
  return role.permissions[Cap.manageWorkspace] == true ||
      role.permissions[Cap.manageMembers] == true ||
      role.permissions[Cap.manageRoles] == true;
}

/// Whether the target's role counts as Owner / Admin-like for the reset rule
/// when the caller is not an Owner. A member without a role is a Member. A
/// role the caller can't resolve (roles list not loaded / not visible) is
/// treated as privileged, so "Reset 2FA" is never offered where the server
/// would answer `MFA_RESET_FORBIDDEN`.
bool isPrivilegedTarget({required String? roleId, required Role? role}) =>
    roleId != null && (role == null || isPrivilegedRole(role));

/// Who sees "Reset 2FA" on a member row (contract 13 §B, mirror of the
/// server rule):
/// - nobody on their own row (`MFA_RESET_SELF_FORBIDDEN`);
/// - an Owner on anyone else;
/// - a non-Owner with MANAGE_MEMBERS (an Admin) only on a member whose role
///   is not Owner / Admin-like (`MFA_RESET_FORBIDDEN` otherwise);
/// - and only on an enrolled row — there is nothing to reset otherwise.
bool canResetMemberMfa({
  required bool isSelf,
  required bool callerIsOwner,
  required bool callerCanManageMembers,
  required bool targetMfaEnabled,
  required bool targetPrivileged,
}) {
  if (isSelf || !targetMfaEnabled) return false;
  if (callerIsOwner) return true;
  return callerCanManageMembers && !targetPrivileged;
}
