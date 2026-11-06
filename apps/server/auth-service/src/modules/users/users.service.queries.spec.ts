import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Chainable Mongoose query stub: select/populate/lean/limit record their
 * argument and return the same query; exec resolves (or rejects) with `value`.
 */
function query(value: unknown, opts: { reject?: boolean } = {}) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ['select', 'populate', 'lean', 'limit']) {
    q[m] = jest.fn(() => q);
  }
  q.exec = opts.reject
    ? jest.fn().mockRejectedValue(value)
    : jest.fn().mockResolvedValue(value);
  return q;
}

function castError() {
  return Object.assign(new Error('Cast to ObjectId failed'), {
    name: 'CastError',
  });
}

function makeService(withRoles = true) {
  const userModel: Record<string, jest.Mock> = {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    updateOne: jest.fn(),
  };
  const userBlockModel: Record<string, jest.Mock> = {
    exists: jest.fn(),
    find: jest.fn(),
    deleteOne: jest.fn(() => query({ deletedCount: 1 })),
  };
  const roleModel = { find: jest.fn() };
  const firebase = { verifyIdToken: jest.fn() };
  const service = new UsersService(
    userModel as never,
    userBlockModel as never,
    firebase as never,
    {} as never,
    withRoles ? (roleModel as never) : undefined,
  );
  return { service, userModel, userBlockModel, roleModel, firebase };
}

const OID = '64b000000000000000000001';

describe('UsersService.getRoleNameMap', () => {
  it('maps every role id (stringified) to its name', async () => {
    const { service, roleModel } = makeService();
    roleModel.find.mockReturnValue(
      query([
        { _id: { toString: () => 'r1' }, name: 'Owner' },
        { _id: 'r2', name: 'Member' },
      ]),
    );
    const map = await service.getRoleNameMap();
    expect([...map.entries()]).toEqual([
      ['r1', 'Owner'],
      ['r2', 'Member'],
    ]);
  });

  it('returns an empty map when the Role model is not injected', async () => {
    const { service } = makeService(false);
    await expect(service.getRoleNameMap()).resolves.toEqual(new Map());
  });
});

describe('UsersService.findByEmailInsensitive', () => {
  it('escapes regex metacharacters and anchors the match (no partial / injection)', async () => {
    const { service, userModel } = makeService();
    const q = query({ _id: 'u1' });
    userModel.findOne.mockReturnValue(q);
    await service.findByEmailInsensitive(' a.b+c@x.io ');
    expect(userModel.findOne).toHaveBeenCalledWith({
      email: { $regex: '^a\\.b\\+c@x\\.io$', $options: 'i' },
    });
    // No select requested → secrets stay hidden.
    expect(q.select).not.toHaveBeenCalled();
  });

  it.each([[''], ['   '], [undefined as unknown as string]])(
    'returns null for blank input %p without querying',
    async (email) => {
      const { service, userModel } = makeService();
      await expect(service.findByEmailInsensitive(email)).resolves.toBeNull();
      expect(userModel.findOne).not.toHaveBeenCalled();
    },
  );
});

describe('UsersService.findByPhone / create', () => {
  it('findByPhone matches the exact number and selects the auth secrets', async () => {
    const { service, userModel } = makeService();
    const q = query({ _id: 'u1' });
    userModel.findOne.mockReturnValue(q);
    await expect(service.findByPhone('+84901234567')).resolves.toEqual({
      _id: 'u1',
    });
    expect(userModel.findOne).toHaveBeenCalledWith({
      phoneNumber: '+84901234567',
    });
    expect(q.select).toHaveBeenCalledWith('+password +otpCode +otpExpires');
  });

  it('create instantiates the model with the data and saves it', async () => {
    const save = jest.fn().mockResolvedValue({ _id: 'new' });
    const ctor = jest.fn(function (this: { save: jest.Mock }) {
      this.save = save;
    });
    const service = new UsersService(
      ctor as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(service.create({ email: 'a@b.c' })).resolves.toEqual({
      _id: 'new',
    });
    expect(ctor).toHaveBeenCalledWith({ email: 'a@b.c' });
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('UsersService.findById', () => {
  it('hides the password and populates the role name', async () => {
    const { service, userModel } = makeService();
    const q = query({ _id: OID });
    userModel.findById.mockReturnValue(q);
    await expect(service.findById(OID)).resolves.toEqual({ _id: OID });
    expect(q.select).toHaveBeenCalledWith('-password');
    expect(q.populate).toHaveBeenCalledWith('roleId', 'name isPreset');
  });

  it('returns null for a non-ObjectId id (CastError, e.g. a bot id)', async () => {
    const { service, userModel } = makeService();
    userModel.findById.mockReturnValue(query(castError(), { reject: true }));
    await expect(service.findById('ai-bot-1')).resolves.toBeNull();
  });

  it('rethrows any other database error', async () => {
    const { service, userModel } = makeService();
    userModel.findById.mockReturnValue(
      query(new Error('connection lost'), { reject: true }),
    );
    await expect(service.findById(OID)).rejects.toThrow('connection lost');
  });
});

describe('UsersService.getHasPassword', () => {
  it('true when a password hash is stored', async () => {
    const { service, userModel } = makeService();
    const q = query({ password: '$2b$hash' });
    userModel.findById.mockReturnValue(q);
    await expect(service.getHasPassword(OID)).resolves.toBe(true);
    expect(q.select).toHaveBeenCalledWith('+password');
  });

  it.each([
    ['OAuth-only user (no password)', { password: undefined }],
    ['unknown user', null],
  ])('false for %s', async (_l, doc) => {
    const { service, userModel } = makeService();
    userModel.findById.mockReturnValue(query(doc));
    await expect(service.getHasPassword(OID)).resolves.toBe(false);
  });

  it('false (not a 500) when the lookup throws', async () => {
    const { service, userModel } = makeService();
    userModel.findById.mockReturnValue(query(castError(), { reject: true }));
    await expect(service.getHasPassword('bad')).resolves.toBe(false);
  });
});

describe('UsersService.findManyByIds', () => {
  it.each([[[]], [undefined as unknown as string[]]])(
    'returns [] for %p without querying',
    async (ids) => {
      const { service, userModel } = makeService();
      await expect(service.findManyByIds(ids)).resolves.toEqual([]);
      expect(userModel.find).not.toHaveBeenCalled();
    },
  );

  it('resolves all ids in ONE $in query without passwords', async () => {
    const { service, userModel } = makeService();
    const q = query([{ _id: 'a' }, { _id: 'b' }]);
    userModel.find.mockReturnValue(q);
    await expect(service.findManyByIds(['a', 'b'])).resolves.toEqual([
      { _id: 'a' },
      { _id: 'b' },
    ]);
    expect(userModel.find).toHaveBeenCalledTimes(1);
    expect(userModel.find).toHaveBeenCalledWith({ _id: { $in: ['a', 'b'] } });
    expect(q.select).toHaveBeenCalledWith('-password');
  });

  it('CastError → [] ; other errors are rethrown', async () => {
    const { service, userModel } = makeService();
    userModel.find.mockReturnValueOnce(query(castError(), { reject: true }));
    await expect(service.findManyByIds(['x'])).resolves.toEqual([]);
    userModel.find.mockReturnValueOnce(
      query(new Error('boom'), { reject: true }),
    );
    await expect(service.findManyByIds(['x'])).rejects.toThrow('boom');
  });
});

describe('UsersService.getMembership', () => {
  it.each([['system'], ['ai-bot-1'], ['123456789012'], ['']])(
    'null for a malformed id %p without querying',
    async (id) => {
      const { service, userModel } = makeService();
      await expect(service.getMembership(id)).resolves.toBeNull();
      expect(userModel.findById).not.toHaveBeenCalled();
    },
  );

  it('null for an unknown user', async () => {
    const { service, userModel } = makeService();
    userModel.findById.mockReturnValue(query(null));
    await expect(service.getMembership(OID)).resolves.toBeNull();
  });

  it('stringifies the role and department ids', async () => {
    const { service, userModel } = makeService();
    const objectId = (s: string) => ({ toString: () => s });
    userModel.findById.mockReturnValue(
      query({ roleId: objectId('r1'), departmentIds: [objectId('d1'), 'd2'] }),
    );
    await expect(service.getMembership(OID)).resolves.toEqual({
      roleId: 'r1',
      departmentIds: ['d1', 'd2'],
    });
  });

  it('no role and no departments → roleId null, departmentIds []', async () => {
    const { service, userModel } = makeService();
    userModel.findById.mockReturnValue(query({ roleId: null }));
    await expect(service.getMembership(OID)).resolves.toEqual({
      roleId: null,
      departmentIds: [],
    });
  });
});

describe('UsersService role / department writes', () => {
  it('countActiveWithRole counts only ACTIVE holders and excludes the given user', async () => {
    const { service, userModel } = makeService();
    userModel.countDocuments.mockReturnValue(query(2));
    await expect(service.countActiveWithRole('r1', 'u1')).resolves.toBe(2);
    expect(userModel.countDocuments).toHaveBeenCalledWith({
      _id: { $ne: 'u1' },
      roleId: 'r1',
      status: 'active',
    });
  });

  it('setRoleAndDepartments writes both fields (null role clears it)', async () => {
    const { service, userModel } = makeService();
    userModel.updateOne.mockReturnValue(query({ modifiedCount: 1 }));
    await service.setRoleAndDepartments('u1', null, ['d1']);
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: 'u1' },
      { $set: { roleId: null, departmentIds: ['d1'] } },
    );
  });
});

describe('UsersService OTP / social links', () => {
  it('updateOtp stores the code and its expiry', async () => {
    const { service, userModel } = makeService();
    const expires = new Date('2026-11-06T10:05:00Z');
    await service.updateOtp('u1', '123456', expires);
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('u1', {
      $set: { otpCode: '123456', otpExpires: expires },
    });
  });

  it('findBySocialId queries the provider-specific socialLinks path', async () => {
    const { service, userModel } = makeService();
    userModel.findOne.mockReturnValue(query({ _id: 'u1' }));
    await expect(service.findBySocialId('google', 'g-1')).resolves.toEqual({
      _id: 'u1',
    });
    expect(userModel.findOne).toHaveBeenCalledWith({
      'socialLinks.google': 'g-1',
    });
  });

  it('updateSocialId links the provider id on the user', async () => {
    const { service, userModel } = makeService();
    await service.updateSocialId('u1', 'google', 'g-1');
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('u1', {
      $set: { 'socialLinks.google': 'g-1' },
    });
  });
});

describe('UsersService.findBySearchQuery', () => {
  it.each([[''], ['   '], [undefined as unknown as string]])(
    'empty query %p returns no users and never lists everyone',
    async (q) => {
      const { service, userModel } = makeService();
      await expect(service.findBySearchQuery(q)).resolves.toEqual({
        users: [],
        matchedBy: 'name_email',
      });
      expect(userModel.find).not.toHaveBeenCalled();
      expect(userModel.findOne).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['Vietnamese local 0xxx → +84', '0901 234-567', '+84901234567'],
    ['already E.164', '+84901234567', '+84901234567'],
    ['digits without + get one', '(1) 415.555.0100', '+14155550100'],
  ])('phone search: %s', async (_l, input, e164) => {
    const { service, userModel } = makeService();
    const q = query({ _id: 'u1' });
    userModel.findOne.mockReturnValue(q);
    await expect(service.findBySearchQuery(input)).resolves.toEqual({
      users: [{ _id: 'u1' }],
      matchedBy: 'phone',
    });
    expect(userModel.findOne).toHaveBeenCalledWith({
      phoneNumber: e164,
      phoneVerified: true,
      showPhoneNumber: true,
      status: 'active',
    });
    expect(userModel.find).not.toHaveBeenCalled();
  });

  it('phone search with no visible match returns [] but still tags matchedBy=phone', async () => {
    const { service, userModel } = makeService();
    userModel.findOne.mockReturnValue(query(null));
    await expect(service.findBySearchQuery('0901234567')).resolves.toEqual({
      users: [],
      matchedBy: 'phone',
    });
  });

  it('6 digits is NOT treated as a phone (falls back to name/email)', async () => {
    const { service, userModel } = makeService();
    userModel.find.mockReturnValue(query([]));
    await expect(service.findBySearchQuery('123456')).resolves.toEqual({
      users: [],
      matchedBy: 'name_email',
    });
    expect(userModel.findOne).not.toHaveBeenCalled();
  });

  it('name/email search escapes metachars, limits to 10 active users and never selects the phone', async () => {
    const { service, userModel } = makeService();
    const q = query([{ _id: 'u1' }]);
    userModel.find.mockReturnValue(q);
    await expect(service.findBySearchQuery('  bob.[x] ')).resolves.toEqual({
      users: [{ _id: 'u1' }],
      matchedBy: 'name_email',
    });
    const filter = userModel.find.mock.calls[0][0];
    const pattern: RegExp = filter.$or[0].email;
    expect(pattern.source).toBe('bob\\.\\[x\\]');
    expect(pattern.flags).toBe('i');
    expect(pattern.test('BOB.[X]')).toBe(true);
    expect(pattern.test('bobx[x]')).toBe(false);
    expect(filter.status).toBe('active');
    expect(q.limit).toHaveBeenCalledWith(10);
    expect(q.select.mock.calls[0][0]).toContain('-phoneNumber');
    expect(q.select.mock.calls[0][0]).toContain('-password');
  });
});

describe('UsersService.updateProfile', () => {
  it('only $sets the provided fields and returns the updated doc without password', async () => {
    const { service, userModel } = makeService();
    const q = query({ _id: 'u1', displayName: 'Bob' });
    userModel.findByIdAndUpdate.mockReturnValue(q);
    await expect(
      service.updateProfile('u1', { displayName: 'Bob', hideInfo: false }),
    ).resolves.toEqual({ _id: 'u1', displayName: 'Bob' });
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      { $set: { displayName: 'Bob', hideInfo: false } },
      { new: true },
    );
    expect(q.select).toHaveBeenCalledWith('-password');
  });

  it('changing the phone always resets phoneVerified; "" is stored as null (sparse unique index)', async () => {
    const { service, userModel } = makeService();
    userModel.findByIdAndUpdate.mockReturnValue(query({}));
    await service.updateProfile('u1', { phoneNumber: '' });
    expect(userModel.findByIdAndUpdate.mock.calls[0][1]).toEqual({
      $set: { phoneNumber: null, phoneVerified: false },
    });
  });

  it('dateOfBirth: a value becomes a Date, "" clears it', async () => {
    const { service, userModel } = makeService();
    userModel.findByIdAndUpdate.mockReturnValue(query({}));
    await service.updateProfile('u1', { dateOfBirth: '2000-01-02' });
    await service.updateProfile('u1', { dateOfBirth: '' });
    expect(
      userModel.findByIdAndUpdate.mock.calls[0][1].$set.dateOfBirth,
    ).toEqual(new Date('2000-01-02'));
    expect(userModel.findByIdAndUpdate.mock.calls[1][1].$set).toEqual({
      dateOfBirth: null,
    });
  });

  it('an empty patch writes nothing and returns the current profile', async () => {
    const { service, userModel } = makeService();
    userModel.findById.mockReturnValue(query({ _id: 'u1' }));
    await expect(service.updateProfile('u1', {})).resolves.toEqual({
      _id: 'u1',
    });
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('UsersService.verifyFirebasePhoneToken', () => {
  it('stores the verified number from the token claims', async () => {
    const { service, userModel, firebase } = makeService();
    firebase.verifyIdToken.mockResolvedValue({ phone_number: '+84901234567' });
    userModel.findOne.mockResolvedValue(null);
    userModel.findByIdAndUpdate.mockReturnValue(query({ _id: 'u1' }));
    await expect(
      service.verifyFirebasePhoneToken('u1', 'tok'),
    ).resolves.toEqual({
      _id: 'u1',
    });
    expect(firebase.verifyIdToken).toHaveBeenCalledWith('tok');
    expect(userModel.findOne).toHaveBeenCalledWith({
      phoneNumber: '+84901234567',
      _id: { $ne: 'u1' },
    });
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      { $set: { phoneNumber: '+84901234567', phoneVerified: true } },
      { new: true },
    );
  });

  it('400 PHONE_TOKEN_INVALID when Firebase rejects the token', async () => {
    const { service, userModel, firebase } = makeService();
    firebase.verifyIdToken.mockRejectedValue(new Error('expired'));
    await expect(
      service.verifyFirebasePhoneToken('u1', 'bad'),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'PHONE_TOKEN_INVALID' },
    });
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('400 PHONE_TOKEN_NO_NUMBER when the token carries no phone', async () => {
    const { service, firebase } = makeService();
    firebase.verifyIdToken.mockResolvedValue({ uid: 'x' });
    await expect(
      service.verifyFirebasePhoneToken('u1', 'tok'),
    ).rejects.toMatchObject({ response: { code: 'PHONE_TOKEN_NO_NUMBER' } });
  });

  it('400 PHONE_ALREADY_TAKEN when another account owns the number — nothing written', async () => {
    const { service, userModel, firebase } = makeService();
    firebase.verifyIdToken.mockResolvedValue({ phone_number: '+84901234567' });
    userModel.findOne.mockResolvedValue({ _id: 'other' });
    await expect(service.verifyFirebasePhoneToken('u1', 'tok')).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.verifyFirebasePhoneToken('u1', 'tok'),
    ).rejects.toMatchObject({ response: { code: 'PHONE_ALREADY_TAKEN' } });
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('404 USER_NOT_FOUND when the caller no longer exists', async () => {
    const { service, userModel, firebase } = makeService();
    firebase.verifyIdToken.mockResolvedValue({ phone_number: '+84901234567' });
    userModel.findOne.mockResolvedValue(null);
    userModel.findByIdAndUpdate.mockReturnValue(query(null));
    await expect(
      service.verifyFirebasePhoneToken('gone', 'tok'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('UsersService block state', () => {
  it('unblockUser deletes only the caller → target block', async () => {
    const { service, userBlockModel } = makeService();
    await expect(service.unblockUser('a', 'b')).resolves.toEqual({
      success: true,
    });
    expect(userBlockModel.deleteOne).toHaveBeenCalledWith({
      blockerId: 'a',
      blockedId: 'b',
    });
  });

  it('isBlockedBy checks owner → caller direction', async () => {
    const { service, userBlockModel } = makeService();
    userBlockModel.exists.mockResolvedValueOnce({ _id: 'blk' });
    await expect(service.isBlockedBy('owner', 'caller')).resolves.toBe(true);
    expect(userBlockModel.exists).toHaveBeenCalledWith({
      blockerId: 'owner',
      blockedId: 'caller',
    });
    userBlockModel.exists.mockResolvedValueOnce(null);
    await expect(service.isBlockedBy('owner', 'caller')).resolves.toBe(false);
  });

  it('findOwnersBlocking: one owner → caller query for the whole list', async () => {
    const { service, userBlockModel } = makeService();
    const q = query([{ blockerId: 'o1' }, { blockerId: 'o3' }]);
    userBlockModel.find.mockReturnValueOnce(q);
    await expect(
      service.findOwnersBlocking(['o1', 'o2', 'o3'], 'caller'),
    ).resolves.toEqual(new Set(['o1', 'o3']));
    expect(userBlockModel.find).toHaveBeenCalledTimes(1);
    expect(userBlockModel.find).toHaveBeenCalledWith({
      blockerId: { $in: ['o1', 'o2', 'o3'] },
      blockedId: 'caller',
    });
    expect(q.select).toHaveBeenCalledWith('blockerId');
  });

  it('findOwnersBlocking: empty list → empty set, no query', async () => {
    const { service, userBlockModel } = makeService();
    await expect(service.findOwnersBlocking([], 'caller')).resolves.toEqual(
      new Set(),
    );
    expect(userBlockModel.find).not.toHaveBeenCalled();
  });

  it('getBlockState reports each direction independently', async () => {
    const { service, userBlockModel } = makeService();
    userBlockModel.exists.mockImplementation(
      async (f: { blockerId: string }) =>
        f.blockerId === 'b' ? { _id: 'x' } : null,
    );
    await expect(service.getBlockState('a', 'b')).resolves.toEqual({
      iBlocked: false,
      blockedMe: true,
    });
  });
});
