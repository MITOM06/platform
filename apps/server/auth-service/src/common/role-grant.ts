import { ForbiddenException } from '@nestjs/common';
import {
  ALL_CAPABILITIES,
  Capability,
  PermissionMatrix,
  enabledCapabilities,
} from '@platform/database';
import { AuthCode } from './auth-code.enum';

export const OWNER_ROLE_NAME = 'Owner';
export const MEMBER_ROLE_NAME = 'Member';

/**
 * Seeded preset role names. Reserved: no other role may take one of them (any
 * casing). The former "Manager" preset is retired, so the name is free again.
 */
export const PRESET_ROLE_NAMES = ['Owner', 'Admin', 'Member'] as const;

/** The acting user as seen in the access token (`JwtUser` satisfies this). */
export interface RoleActor {
  sub: string;
  /** Role NAME from the JWT `role` claim. */
  role?: string;
  /** Capability keys from the JWT `perms` claim. */
  perms?: string[];
}

export function isOwnerActor(
  actor: Pick<RoleActor, 'role'> | undefined,
): boolean {
  return actor?.role === OWNER_ROLE_NAME;
}

export function isReservedRoleName(name: string): boolean {
  const n = (name ?? '').trim().toLowerCase();
  return PRESET_ROLE_NAMES.some((preset) => preset.toLowerCase() === n);
}

/**
 * Capabilities enabled by any of `matrices` that `actorPerms` does not include, in catalog
 * order. "Enabled" means exactly what ClaimsService grants (`=== true`), so the check matches
 * what the role would really put into someone's token.
 */
export function capabilitiesBeyond(
  actorPerms: readonly string[] | undefined,
  ...matrices: Array<PermissionMatrix | null | undefined>
): Capability[] {
  const own = new Set(actorPerms ?? []);
  const granted = new Set<Capability>();
  for (const matrix of matrices) {
    for (const cap of enabledCapabilities(matrix ?? {})) {
      granted.add(cap);
    }
  }
  return ALL_CAPABILITIES.filter((cap) => granted.has(cap) && !own.has(cap));
}

/**
 * Anti-escalation rule: a non-Owner may only create/edit/assign a role whose every capability
 * they hold themselves — otherwise an Admin could mint (or hand out) a role above their own,
 * e.g. add MANAGE_WORKSPACE to the Admin role or clone the Owner matrix into a custom role.
 * The Owner is exempt (they already hold everything).
 *
 * @throws 403 ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS, params `{ capabilities: [...missing] }`
 */
export function assertCanGrant(
  actor: RoleActor,
  ...matrices: Array<PermissionMatrix | null | undefined>
): void {
  if (isOwnerActor(actor)) return;
  const missing = capabilitiesBeyond(actor.perms, ...matrices);
  if (missing.length > 0) {
    throw new ForbiddenException({
      code: AuthCode.ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS,
      params: { capabilities: missing },
    });
  }
}
