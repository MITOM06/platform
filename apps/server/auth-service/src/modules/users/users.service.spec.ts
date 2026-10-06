import { UsersService } from './users.service';

const exec = (value: any) => ({ exec: jest.fn().mockResolvedValue(value) });

function makeService() {
  const userModel: any = {
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    updateMany: jest.fn().mockReturnValue(exec({ modifiedCount: 0 })),
    updateOne: jest.fn().mockReturnValue(exec({ modifiedCount: 1 })),
  };
  const userBlockModel: any = {
    updateOne: jest.fn().mockResolvedValue({}),
    deleteOne: jest.fn().mockReturnValue(exec({})),
  };
  const friends: any = { removeFriend: jest.fn().mockResolvedValue(undefined) };
  const service = new UsersService(
    userModel,
    userBlockModel,
    {} as any,
    friends,
  );
  return { service, userModel, userBlockModel, friends };
}

/** findOne(...).select(...).exec() chain that records the filter and select. */
function findOneReturning(...results: any[]) {
  const calls: Array<{ filter: any; select?: string }> = [];
  let i = 0;
  const impl = jest.fn((filter: any) => {
    const call: { filter: any; select?: string } = { filter };
    calls.push(call);
    const value = results[i++] ?? null;
    return {
      select: (sel: string) => {
        call.select = sel;
        return exec(value);
      },
      exec: jest.fn().mockResolvedValue(value),
    };
  });
  return { impl, calls };
}

describe('UsersService.findByEmail (case-insensitive login lookup)', () => {
  it('looks up the normalized address first, with the auth secrets selected', async () => {
    const { service, userModel } = makeService();
    const { impl, calls } = findOneReturning({
      _id: 'u1',
      email: 'bob@qc.test',
    });
    userModel.findOne = impl;

    await expect(service.findByEmail('  Bob@QC.test ')).resolves.toMatchObject({
      _id: 'u1',
    });
    expect(calls).toEqual([
      {
        filter: { email: 'bob@qc.test' },
        select: '+password +otpCode +otpExpires',
      },
    ]);
  });

  it('falls back to an anchored case-insensitive match for legacy mixed-case rows', async () => {
    const { service, userModel } = makeService();
    const { impl, calls } = findOneReturning(null, {
      _id: 'legacy',
      email: 'Bob@QC.test',
    });
    userModel.findOne = impl;

    await expect(service.findByEmail('bob@qc.test')).resolves.toMatchObject({
      _id: 'legacy',
    });
    expect(calls[1]).toEqual({
      filter: { email: { $regex: '^bob@qc\\.test$', $options: 'i' } },
      select: '+password +otpCode +otpExpires',
    });
  });

  it('returns null for a blank address without querying', async () => {
    const { service, userModel } = makeService();
    await expect(service.findByEmail('   ')).resolves.toBeNull();
    expect(userModel.findOne).not.toHaveBeenCalled();
  });
});

describe('UsersService.setVerified', () => {
  it('marks the email verified WITHOUT consuming the OTP (reset needs the same code)', async () => {
    const { service, userModel } = makeService();
    await service.setVerified('u1');
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('u1', {
      $set: { isVerified: true },
    });
    const update = userModel.findByIdAndUpdate.mock.calls[0][1];
    expect(update.$unset).toBeUndefined();
  });

  it('updatePassword is what consumes the OTP', async () => {
    const { service, userModel } = makeService();
    await service.updatePassword('u1', 'hash');
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('u1', {
      // Any new password also completes the Google-invite onboarding step.
      $set: { password: 'hash', mustSetPassword: false },
      $unset: { otpCode: '', otpExpires: '' },
    });
  });
});

describe('UsersService device tokens (FCM)', () => {
  it('registering a token moves it off every OTHER account first', async () => {
    const { service, userModel } = makeService();
    await service.addDeviceToken('u2', 'fcm-1');
    expect(userModel.updateMany).toHaveBeenCalledWith(
      { _id: { $ne: 'u2' }, fcmTokens: 'fcm-1' },
      { $pull: { fcmTokens: 'fcm-1' } },
    );
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('u2', {
      $addToSet: { fcmTokens: 'fcm-1' },
    });
    expect(userModel.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      userModel.findByIdAndUpdate.mock.invocationCallOrder[0],
    );
  });

  it('ignores an empty / non-string token', async () => {
    const { service, userModel } = makeService();
    await service.addDeviceToken('u2', '');
    await service.addDeviceToken('u2', { $ne: null } as any);
    expect(userModel.updateMany).not.toHaveBeenCalled();
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("removeDeviceToken pulls the token from the caller's account only (idempotent)", async () => {
    const { service, userModel } = makeService();
    await service.removeDeviceToken('u1', 'fcm-1');
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: 'u1' },
      { $pull: { fcmTokens: 'fcm-1' } },
    );
  });
});

describe('UsersService.blockUser', () => {
  it('records the block and ends the friendship / pending request in both directions', async () => {
    const { service, userBlockModel, friends } = makeService();
    await expect(service.blockUser('a', 'b')).resolves.toEqual({
      success: true,
    });
    expect(userBlockModel.updateOne).toHaveBeenCalledWith(
      { blockerId: 'a', blockedId: 'b' },
      { $setOnInsert: { blockerId: 'a', blockedId: 'b' } },
      { upsert: true },
    );
    expect(friends.removeFriend).toHaveBeenCalledWith('a', 'b');
  });

  it('self-block → 409 with code CANNOT_BLOCK_SELF and the legacy message', async () => {
    const { service, friends } = makeService();
    await expect(service.blockUser('a', 'a')).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'CANNOT_BLOCK_SELF',
        message: 'You cannot block yourself',
      },
    });
    expect(friends.removeFriend).not.toHaveBeenCalled();
  });
});
