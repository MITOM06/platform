/**
 * The ONE mapping from a user document to what another member may see.
 * Used by `GET /api/users/:id`, the batch `GET /api/users?ids=`, and every
 * friends list (`GET /api/friends`, `/api/friends/requests`,
 * `/api/users/friends/online`) — the friends lists used to return raw user
 * documents, leaking fcmTokens / trustedDevices / socialLinks and the phone,
 * date of birth and gender regardless of the owner's `show*` toggles.
 *
 * Explicit whitelist: NEVER add fcmTokens, trustedDevices, socialLinks, status,
 * password, otpCode, otpExpires, roleId/departmentIds internals.
 */
export interface PublicProfileOptions {
  /** Included when known (profile endpoints compute it; friends lists do not). */
  friendsCount?: number;
  /** The profile owner blocked the caller → minimal view only. */
  isBlockedByOwner?: boolean;
  /**
   * Also expose `email` to non-self callers. Friends lists did and the clients
   * render it (search results expose it to every member too); the profile
   * endpoints never did, so they keep omitting it.
   */
  includeEmail?: boolean;
  /**
   * The resolved role name (UsersService.getRoleName / getRoleNameMap — `roleId`
   * has no Mongoose ref, so it can't be populated). Unassigned → 'Member'.
   */
  roleName?: string;
}

export function toPublicProfile(
  doc: any,
  callerId: string,
  opts: PublicProfileOptions = {},
): Record<string, unknown> {
  const isSelf = callerId === String(doc._id);

  // Caller is blocked by the profile owner → return minimal public info only.
  // Tells the client to hide action buttons and sensitive profile details.
  if (!isSelf && opts.isBlockedByOwner) {
    return {
      _id: doc._id,
      id: doc._id,
      displayName: doc.displayName,
      avatarUrl: doc.avatarUrl ?? '',
      coverPhoto: doc.coverPhoto ?? '',
      email: doc.email,
      isVerified: doc.isVerified ?? false,
      friendsCount: 0,
      bio: '',
      isBlockedByOwner: true,
    };
  }

  const profile: Record<string, unknown> = {
    _id: doc._id,
    id: doc._id,
    displayName: doc.displayName,
    avatarUrl: doc.avatarUrl ?? '',
    coverPhoto: doc.coverPhoto ?? '',
    isVerified: doc.isVerified ?? false,
    hideInfo: doc.hideInfo ?? false, // legacy fallback safety-net
    createdAt: doc.createdAt,
    // Role is always public — no privacy gate. null → client shows "Member".
    roleName: opts.roleName ?? doc.roleId?.name ?? null,
  };
  if (opts.friendsCount !== undefined) profile.friendsCount = opts.friendsCount;
  if (opts.includeEmail) profile.email = doc.email;

  // Per-field visibility. New per-field flags win; when absent on legacy
  // docs, fall back to the legacy `!hideInfo` behaviour.
  const showDob = doc.showDateOfBirth ?? !doc.hideInfo;
  const showPhone = doc.showPhoneNumber ?? !doc.hideInfo;
  const showGen = doc.showGender ?? !doc.hideInfo;

  // bio is never gated — always public.
  profile.bio = doc.bio;

  if (isSelf) {
    // Self gets everything + the toggle flags to seed the edit form.
    profile.email = doc.email;
    profile.phoneVerified = doc.phoneVerified ?? false;
    profile.showDateOfBirth = showDob;
    profile.showPhoneNumber = showPhone;
    profile.showGender = showGen;
  }

  if (isSelf || showDob) profile.dateOfBirth = doc.dateOfBirth;
  if (isSelf || showPhone) profile.phoneNumber = doc.phoneNumber;
  if (isSelf || showGen) profile.gender = doc.gender;

  return profile;
}
