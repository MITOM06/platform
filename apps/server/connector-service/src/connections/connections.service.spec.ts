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
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    adapter = { revoke: jest.fn().mockResolvedValue('revoked') };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    svc = new ConnectionsService(connModel, {} as any, { forProvider: () => adapter } as any, audit as any);
  });

  it('listConnections never returns encryptedTokens and exposes status', async () => {
    const views = await svc.listConnections('u1');
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ id: 'c1', provider: 'notion', status: 'expired' });
    expect(JSON.stringify(views)).not.toContain('encryptedTokens');
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
});
