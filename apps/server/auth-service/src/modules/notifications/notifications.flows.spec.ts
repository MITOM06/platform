import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

const exec = (v: unknown) => ({ exec: jest.fn().mockResolvedValue(v) });

function makeModel() {
  const limit = jest.fn().mockReturnValue(exec([{ _id: 'n1' }]));
  const sort = jest.fn().mockReturnValue({ limit });
  return {
    model: {
      create: jest.fn().mockImplementation(async (p) => ({ _id: 'n1', ...p })),
      find: jest.fn().mockReturnValue({ sort }),
      countDocuments: jest.fn().mockResolvedValue(4),
      updateMany: jest.fn().mockReturnValue(exec({ modifiedCount: 1 })),
      updateOne: jest.fn().mockReturnValue(exec({ upsertedCount: 1 })),
    },
    sort,
    limit,
  };
}

describe('NotificationsService', () => {
  it('create persists the payload as given', async () => {
    const { model } = makeModel();
    const svc = new NotificationsService(model as never);
    const payload = { recipientId: 'u1', type: 'FRIEND_REQUEST' as const, title: 't' };
    await expect(svc.create(payload)).resolves.toEqual({ _id: 'n1', ...payload });
    expect(model.create).toHaveBeenCalledWith(payload);
  });

  it('listForUser: only the recipient, newest first, default limit 50', async () => {
    const { model, sort, limit } = makeModel();
    const svc = new NotificationsService(model as never);
    await expect(svc.listForUser('u1')).resolves.toEqual([{ _id: 'n1' }]);
    expect(model.find).toHaveBeenCalledWith({ recipientId: 'u1' });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(50);
  });

  it('listForUser honours an explicit limit', async () => {
    const { model, limit } = makeModel();
    await new NotificationsService(model as never).listForUser('u1', 5);
    expect(limit).toHaveBeenCalledWith(5);
  });

  it('countUnread counts only the recipient unread rows', async () => {
    const { model } = makeModel();
    await expect(new NotificationsService(model as never).countUnread('u1')).resolves.toBe(4);
    expect(model.countDocuments).toHaveBeenCalledWith({ recipientId: 'u1', readAt: null });
  });

  it('markAllRead touches only the caller unread rows', async () => {
    const { model } = makeModel();
    await expect(new NotificationsService(model as never).markAllRead('u1')).resolves.toBeUndefined();
    expect(model.updateMany).toHaveBeenCalledWith(
      { recipientId: 'u1', readAt: null },
      { $set: { readAt: expect.any(Date) } },
    );
  });

  describe('createSetupNotificationsIfNeeded', () => {
    it('OAuth-only + unverified phone → upserts PASSWORD_SETUP and PHONE_SETUP once each ($setOnInsert)', async () => {
      const { model } = makeModel();
      await new NotificationsService(model as never).createSetupNotificationsIfNeeded('u1', {
        hasPassword: false,
        phoneVerified: false,
      });
      expect(model.updateOne).toHaveBeenCalledTimes(2);
      const [pwFilter, pwUpdate, pwOpts] = model.updateOne.mock.calls[0];
      expect(pwFilter).toEqual({ recipientId: 'u1', type: 'PASSWORD_SETUP' });
      expect(pwUpdate.$setOnInsert).toMatchObject({
        recipientId: 'u1',
        type: 'PASSWORD_SETUP',
        readAt: null,
      });
      expect(pwUpdate.$set).toBeUndefined(); // never resurrects a read nudge
      expect(pwOpts).toEqual({ upsert: true });
      expect(model.updateOne.mock.calls[1][0]).toEqual({ recipientId: 'u1', type: 'PHONE_SETUP' });
      expect(model.updateMany).not.toHaveBeenCalled();
    });

    it('has password + verified phone → no new nudge; outstanding PHONE_SETUP is auto-read', async () => {
      const { model } = makeModel();
      await new NotificationsService(model as never).createSetupNotificationsIfNeeded('u1', {
        hasPassword: true,
        phoneVerified: true,
      });
      expect(model.updateOne).not.toHaveBeenCalled();
      expect(model.updateMany).toHaveBeenCalledWith(
        { recipientId: 'u1', type: 'PHONE_SETUP', readAt: null },
        { $set: { readAt: expect.any(Date) } },
      );
    });

    it('has password + unverified phone → only PHONE_SETUP', async () => {
      const { model } = makeModel();
      await new NotificationsService(model as never).createSetupNotificationsIfNeeded('u1', {
        hasPassword: true,
        phoneVerified: false,
      });
      expect(model.updateOne).toHaveBeenCalledTimes(1);
      expect(model.updateOne.mock.calls[0][0].type).toBe('PHONE_SETUP');
    });

    it('a DB error is propagated (not swallowed)', async () => {
      const { model } = makeModel();
      model.updateOne.mockReturnValue({ exec: jest.fn().mockRejectedValue(new Error('down')) });
      await expect(
        new NotificationsService(model as never).createSetupNotificationsIfNeeded('u1', {
          hasPassword: false,
          phoneVerified: true,
        }),
      ).rejects.toThrow('down');
    });
  });
});

describe('NotificationsController — always scoped to the token subject', () => {
  const req = { user: { sub: 'me' } };
  const svc = {
    listForUser: jest.fn().mockResolvedValue([]),
    countUnread: jest.fn().mockResolvedValue(3),
    markRead: jest.fn().mockResolvedValue(undefined),
    markAllRead: jest.fn().mockResolvedValue(undefined),
  };
  const ctrl = new NotificationsController(svc as never);
  beforeEach(() => jest.clearAllMocks());

  it('list / unread-count', async () => {
    await expect(ctrl.list(req)).resolves.toEqual([]);
    expect(svc.listForUser).toHaveBeenCalledWith('me');
    await expect(ctrl.unreadCount(req)).resolves.toEqual({ count: 3 });
    expect(svc.countUnread).toHaveBeenCalledWith('me');
  });

  it('markRead passes (id, caller) so a foreign id cannot be marked', async () => {
    await ctrl.markRead(req, 'n9');
    expect(svc.markRead).toHaveBeenCalledWith('n9', 'me');
  });

  it('read-all', async () => {
    await ctrl.markAllRead(req);
    expect(svc.markAllRead).toHaveBeenCalledWith('me');
  });
});
