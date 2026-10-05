/**
 * In-memory stand-in for the Mongoose User model, covering exactly the queries
 * the MFA services run: findById().select().exec() (with the select:false
 * behaviour of mfa.secretEnc / mfa.backupCodeHashes) and updateOne() with
 * $set / $pull / $unset on `mfa`. Test-only: excluded from the build.
 */
export interface FakeUser {
  _id: string;
  email: string;
  displayName: string;
  status?: string;
  isBot?: boolean;
  phoneVerified?: boolean;
  mustSetPassword?: boolean;
  mfa?: {
    enabled?: boolean;
    secretEnc?: string;
    enrolledAt?: Date;
    backupCodeHashes?: string[];
  };
}

const HIDDEN_MFA_FIELDS = ['secretEnc', 'backupCodeHashes'] as const;

export function createFakeUserModel(...seed: FakeUser[]) {
  const users = new Map<string, FakeUser>(
    seed.map((u) => [u._id, structuredClone(u)]),
  );

  const project = (user: FakeUser, select: string) => {
    const copy = structuredClone(user);
    if (copy.mfa) {
      for (const field of HIDDEN_MFA_FIELDS) {
        if (!select.includes(`+mfa.${field}`)) delete copy.mfa[field];
      }
    }
    return { ...copy, toObject: () => structuredClone(copy) };
  };

  const matches = (user: FakeUser, filter: Record<string, unknown>) =>
    Object.entries(filter).every(([path, cond]) => {
      if (path === '_id') return user._id === String(cond);
      if (path === 'mfa.enabled') {
        const enabled = user.mfa?.enabled === true;
        return typeof cond === 'object' && cond !== null && '$ne' in cond
          ? enabled !== (cond as { $ne: boolean }).$ne
          : enabled === cond;
      }
      if (path === 'mfa.backupCodeHashes') {
        return (user.mfa?.backupCodeHashes ?? []).includes(cond as string);
      }
      throw new Error(`FakeUserModel: unsupported filter ${path}`);
    });

  const apply = (user: FakeUser, update: Record<string, any>) => {
    if (update.$set?.mfa) user.mfa = structuredClone(update.$set.mfa);
    if (update.$set?.['mfa.backupCodeHashes']) {
      user.mfa = {
        ...user.mfa,
        backupCodeHashes: [...update.$set['mfa.backupCodeHashes']],
      };
    }
    if (update.$pull?.['mfa.backupCodeHashes']) {
      const gone = update.$pull['mfa.backupCodeHashes'];
      user.mfa!.backupCodeHashes = user.mfa!.backupCodeHashes!.filter(
        (h) => h !== gone,
      );
    }
    if (update.$unset?.mfa) delete user.mfa;
  };

  return {
    users,
    findById: jest.fn((id: string) => {
      let select = '';
      const query = {
        select: (s: string) => {
          select = s;
          return query;
        },
        exec: async () => {
          const user = users.get(String(id));
          return user ? project(user, select) : null;
        },
      };
      return query;
    }),
    updateOne: jest.fn(
      (filter: Record<string, unknown>, update: Record<string, any>) => ({
        exec: async () => {
          const user = [...users.values()].find((u) => matches(u, filter));
          if (!user) return { matchedCount: 0, modifiedCount: 0 };
          apply(user, update);
          return { matchedCount: 1, modifiedCount: 1 };
        },
      }),
    ),
  };
}
