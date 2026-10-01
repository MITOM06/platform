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
