import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Capability } from '@platform/database';
import { ConnectionsService } from './connections.service';

const ID = '6650c0ffee0123456789abcd';
const user = (perms: string[] = []) => ({ sub: 'u1', sid: 's', perms }) as any;

describe('ConnectionsService', () => {
  let svc: ConnectionsService;
  let connModel: any;
  let adapter: { revoke: jest.Mock };
  let audit: { record: jest.Mock };

  const lean = (v: unknown) => ({ lean: jest.fn().mockResolvedValue(v) });

  beforeEach(() => {
    connModel = {
      find: jest.fn().mockReturnValue(
        lean([
          {
            _id: 'c1',
            userId: 'u1',
            provider: 'notion',
            status: 'expired',
            scopes: ['read_content'],
            accountLabel: 'My Workspace',
            lastUsedAt: new Date('2026-06-19T00:00:00Z'),
            encryptedTokens: { iv: 'x', tag: 'y', data: 'z' },
          },
        ]),
      ),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    adapter = { revoke: jest.fn().mockResolvedValue('revoked') };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    svc = new ConnectionsService(connModel, {} as any, { forProvider: () => adapter } as any, audit as any);
  });

  it('listConnections never returns encryptedTokens and exposes status', async () => {
    const views = await svc.listConnections('u1');
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ id: 'c1', provider: 'notion', status: 'expired', autoRun: false });
    expect(JSON.stringify(views)).not.toContain('encryptedTokens');
  });

  describe('connection permissions', () => {
    it('getConnectionPermissions defaults to every group and autoRun off', async () => {
      connModel.findOne.mockReturnValue(lean({ _id: ID, userId: 'u1' }));
      expect(await svc.getConnectionPermissions('u1', ID)).toEqual({
        actionGroups: ['view', 'create', 'edit', 'delete'],
        autoRun: false,
      });
    });

    it('updateConnectionPermissions leaves autoRun alone when the client omits it (older clients)', async () => {
      connModel.findOneAndUpdate.mockReturnValue(lean({ _id: ID, userId: 'u1', actionGroups: ['view'], autoRun: true }));
      const view = await svc.updateConnectionPermissions('u1', ID, ['view']);
      expect(connModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: ID, userId: 'u1' },
        { $set: { actionGroups: ['view'] } },
        { new: true },
      );
      expect(view).toEqual({ actionGroups: ['view'], autoRun: true });
    });

    it('updateConnectionPermissions sets autoRun only for the owner and audits it', async () => {
      connModel.findOneAndUpdate.mockReturnValue(lean({ _id: ID, userId: 'u1', actionGroups: ['view', 'create'], autoRun: true }));
      const view = await svc.updateConnectionPermissions('u1', ID, ['view', 'create'], true);
      expect(connModel.findOneAndUpdate.mock.calls[0][1]).toEqual({ $set: { actionGroups: ['view', 'create'], autoRun: true } });
      expect(view).toEqual({ actionGroups: ['view', 'create'], autoRun: true });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'connection.permissions.update', meta: { actionGroups: ['view', 'create'], autoRun: true } }),
      );
      connModel.findOneAndUpdate.mockReturnValue(lean(null));
      await expect(svc.updateConnectionPermissions('u2', ID, ['view'], true)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('listConnections returns the caller personal connections PLUS workspace-scoped ones', async () => {
    await svc.listConnections('u1');
    expect(connModel.find.mock.calls[0][0]).toEqual({ $or: [{ userId: 'u1' }, { scope: 'workspace' }] });
  });

  it('owner deletes a personal connection after a best-effort provider revoke', async () => {
    connModel.findOne.mockReturnValue(lean({ _id: ID, userId: 'u1', provider: 'gmail', scope: 'personal' }));
    expect(await svc.deleteConnection(user(), ID)).toEqual({ deleted: true });
    expect(adapter.revoke).toHaveBeenCalledWith(expect.objectContaining({ provider: 'gmail', userId: 'u1' }));
    expect(connModel.deleteOne).toHaveBeenCalledWith({ _id: ID });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('a workspace connection needs CONNECT_WORKSPACE_CONNECTOR to delete (403 otherwise)', async () => {
    connModel.findOne.mockReturnValue(lean({ _id: ID, userId: 'admin', provider: 'stripe', scope: 'workspace' }));
    await expect(svc.deleteConnection(user(), ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(connModel.deleteOne).not.toHaveBeenCalled();
  });

  it('a CONNECT_WORKSPACE_CONNECTOR holder deletes a workspace connection (audited)', async () => {
    connModel.findOne.mockReturnValue(lean({ _id: ID, userId: 'admin', provider: 'stripe', scope: 'workspace' }));
    adapter.revoke.mockResolvedValue('unsupported');
    expect(await svc.deleteConnection(user([Capability.CONNECT_WORKSPACE_CONNECTOR]), ID)).toEqual({ deleted: true });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'connector.disconnect',
        targetId: 'stripe',
        meta: expect.objectContaining({ scope: 'workspace', ownerId: 'admin', revoke: 'unsupported' }),
      }),
    );
  });

  it('a failing revoke never blocks the delete', async () => {
    connModel.findOne.mockReturnValue(lean({ _id: ID, userId: 'u1', provider: 'gmail', scope: 'personal' }));
    adapter.revoke.mockRejectedValue(new Error('google down'));
    expect(await svc.deleteConnection(user(), ID)).toEqual({ deleted: true });
  });

  it('404s an unknown/foreign connection and a malformed id', async () => {
    connModel.findOne.mockReturnValue(lean(null));
    await expect(svc.deleteConnection(user(), ID)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.deleteConnection(user(), 'not-an-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('full authority (autoRun) — who may turn it on', () => {
    it('defaults autoRun to OFF for every listed connection, even with junk values', async () => {
      connModel.find.mockReturnValue(
        lean([
          { _id: 'a', provider: 'gmail', status: 'active' },
          { _id: 'b', provider: 'notion', status: 'active', autoRun: 'yes' },
          { _id: 'c', provider: 'drive', status: 'active', autoRun: true, scope: 'workspace' },
        ]),
      );
      const views = await svc.listConnections('u1');
      expect(views.map((v) => [v.id, v.autoRun, v.scope])).toEqual([
        ['a', false, 'personal'],
        ['b', false, 'personal'],
        ['c', true, 'workspace'],
      ]);
      expect(views[0]).toMatchObject({ scopes: [], actionGroups: ['view', 'create', 'edit', 'delete'] });
    });

    it('a non-owner (incl. a workspace member) can never write the flag: the update is scoped to userId', async () => {
      connModel.findOneAndUpdate.mockReturnValue(lean(null));
      await expect(svc.updateConnectionPermissions('member', ID, ['view', 'create'], true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(connModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: ID, userId: 'member' },
        { $set: { actionGroups: ['view', 'create'], autoRun: true } },
        { new: true },
      );
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('the owner can turn autoRun back OFF (false is written, not dropped)', async () => {
      connModel.findOneAndUpdate.mockReturnValue(lean({ _id: ID, userId: 'u1', autoRun: false }));
      expect(await svc.updateConnectionPermissions('u1', ID, ['view'], false)).toEqual({
        actionGroups: ['view'],
        autoRun: false,
      });
      expect(connModel.findOneAndUpdate.mock.calls[0][1]).toEqual({ $set: { actionGroups: ['view'], autoRun: false } });
    });

    it('a malformed id never reaches the DB (get + update)', async () => {
      await expect(svc.updateConnectionPermissions('u1', '{"$ne":null}', ['view'], true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(svc.getConnectionPermissions('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
      expect(connModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(connModel.findOne).not.toHaveBeenCalled();
    });

    it('reading permissions of a connection the caller cannot see is a 404', async () => {
      connModel.findOne.mockReturnValue(lean(null));
      await expect(svc.getConnectionPermissions('u2', ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(connModel.findOne).toHaveBeenCalledWith({ _id: ID, $or: [{ userId: 'u2' }, { scope: 'workspace' }] });
    });

    it('an empty grant is stored as-is (connection linked but the AI cannot act)', async () => {
      connModel.findOneAndUpdate.mockReturnValue(lean({ _id: ID, userId: 'u1', actionGroups: [] }));
      expect(await svc.updateConnectionPermissions('u1', ID, [])).toEqual({ actionGroups: [], autoRun: false });
    });
  });

  it('a provider without revoke support is deleted with outcome "unsupported"', async () => {
    connModel.findOne.mockReturnValue(lean({ _id: ID, userId: 'admin', provider: 'stripe', scope: 'workspace' }));
    svc = new ConnectionsService(connModel, {} as any, { forProvider: () => ({}) } as any, audit as any);
    await svc.deleteConnection(user([Capability.CONNECT_WORKSPACE_CONNECTOR]), ID);
    expect(audit.record.mock.calls[0][0].meta.revoke).toBe('unsupported');
  });

  it('a failed revoke on a workspace delete is audited as "failed"', async () => {
    connModel.findOne.mockReturnValue(lean({ _id: ID, userId: 'admin', provider: 'gmail', scope: 'workspace' }));
    adapter.revoke.mockRejectedValue(new Error('google down'));
    await svc.deleteConnection(user([Capability.CONNECT_WORKSPACE_CONNECTOR]), ID);
    expect(audit.record.mock.calls[0][0].meta.revoke).toBe('failed');
    expect(connModel.deleteOne).toHaveBeenCalledWith({ _id: ID });
  });

  it('a user with no perms array cannot delete a workspace connection', async () => {
    connModel.findOne.mockReturnValue(lean({ _id: ID, userId: 'admin', provider: 'stripe', scope: 'workspace' }));
    await expect(svc.deleteConnection({ sub: 'u1', sid: 's' } as any, ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adapter.revoke).not.toHaveBeenCalled();
  });

  describe('skills', () => {
    it('lists only the caller skills and upserts a toggle', async () => {
      const skillModel = {
        find: jest.fn().mockReturnValue(lean([{ skillId: 'mail', enabled: true, userId: 'u1', _id: 'x' }])),
        updateOne: jest.fn().mockResolvedValue({}),
      };
      svc = new ConnectionsService(connModel, skillModel as any, { forProvider: () => adapter } as any, audit as any);
      expect(await svc.listSkills('u1')).toEqual([{ skillId: 'mail', enabled: true }]);
      expect(skillModel.find).toHaveBeenCalledWith({ userId: 'u1' });
      expect(await svc.setSkill('u1', 'mail', false)).toEqual({ skillId: 'mail', enabled: false });
      expect(skillModel.updateOne).toHaveBeenCalledWith(
        { userId: 'u1', skillId: 'mail' },
        { $set: { enabled: false } },
        { upsert: true },
      );
    });
  });
});
