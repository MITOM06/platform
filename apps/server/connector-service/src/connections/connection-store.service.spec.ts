import { Logger } from '@nestjs/common';
import { ConnectionStoreService } from './connection-store.service';

describe('ConnectionStoreService.upsert', () => {
  let connModel: { find: jest.Mock; deleteMany: jest.Mock; updateOne: jest.Mock };
  let audit: { record: jest.Mock };
  let others: Array<{ _id: unknown; userId: string }>;
  let svc: ConnectionStoreService;

  beforeEach(() => {
    others = [];
    connModel = {
      find: jest.fn(() => ({ lean: () => Promise.resolve(others) })),
      deleteMany: jest.fn().mockResolvedValue({}),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    svc = new ConnectionStoreService(connModel as any, audit as any);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('personal scope: no supersede, forces status active + scope, upserts by (userId, provider)', async () => {
    await svc.upsert({ userId: 'u1', provider: 'notion', scope: 'personal', set: { status: 'expired', mcpUrl: 'm' } as any });
    expect(connModel.find).not.toHaveBeenCalled();
    expect(connModel.updateOne).toHaveBeenCalledWith(
      { userId: 'u1', provider: 'notion' },
      { $set: { mcpUrl: 'm', status: 'active', scope: 'personal' } },
      { upsert: true },
    );
  });

  it('unset drops fields that are also being set and omits $unset when nothing remains', async () => {
    await svc.upsert({
      userId: 'u1',
      provider: 'notion',
      scope: 'personal',
      set: { tokenEndpoint: 't' } as any,
      unset: ['tokenEndpoint'],
    });
    expect(connModel.updateOne.mock.calls[0][1]).not.toHaveProperty('$unset');

    await svc.upsert({
      userId: 'u1',
      provider: 'notion',
      scope: 'personal',
      set: { accountLabel: 'ws' } as any,
      unset: ['tokenEndpoint', 'encryptedClientCreds', 'accountLabel'],
    });
    expect(connModel.updateOne.mock.calls[1][1].$unset).toEqual({ tokenEndpoint: '', encryptedClientCreds: '' });
  });

  it('workspace scope with no other holder: nothing deleted, nothing audited', async () => {
    await svc.upsert({ userId: 'admin1', provider: 'stripe', scope: 'workspace', set: {} });
    expect(connModel.find).toHaveBeenCalledWith(
      { provider: 'stripe', scope: 'workspace', userId: { $ne: 'admin1' } },
      { _id: 1, userId: 1 },
    );
    expect(connModel.deleteMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(connModel.updateOne).toHaveBeenCalledTimes(1);
  });

  it('workspace scope replaces OTHER admins’ workspace connections and audits connector.replace', async () => {
    others = [
      { _id: 'c2', userId: 'admin2' },
      { _id: 'c3', userId: 'admin3' },
    ];
    await svc.upsert({ userId: 'admin1', provider: 'stripe', scope: 'workspace', set: { mcpUrl: 'x' } as any });
    expect(connModel.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['c2', 'c3'] } });
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'admin1',
      action: 'connector.replace',
      targetType: 'connector',
      targetId: 'stripe',
      meta: {
        scope: 'workspace',
        replacedConnectionIds: ['c2', 'c3'],
        replacedOwnerIds: ['admin2', 'admin3'],
      },
    });
    // The new connection is written after the old ones are gone.
    expect(connModel.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      connModel.updateOne.mock.invocationCallOrder[0],
    );
  });

  it('a failing delete aborts before writing the new connection', async () => {
    others = [{ _id: 'c2', userId: 'admin2' }];
    connModel.deleteMany.mockRejectedValue(new Error('db down'));
    await expect(svc.upsert({ userId: 'admin1', provider: 'stripe', scope: 'workspace', set: {} })).rejects.toThrow(
      'db down',
    );
    expect(connModel.updateOne).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
