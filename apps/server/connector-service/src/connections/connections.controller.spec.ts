import { JwtAuthGuard } from '@platform/database';
import { ConnectionsController } from './connections.controller';

/**
 * Task 2.2 — user-facing connector endpoints must derive userId from the
 * verified JWT (`req.user.sub`), NOT from a trusted query param.
 */
describe('ConnectionsController (JWT-derived identity)', () => {
  let controller: ConnectionsController;
  let service: any;

  beforeEach(() => {
    service = {
      listConnections: jest.fn().mockResolvedValue([]),
      listSkills: jest.fn().mockResolvedValue([]),
      setSkill: jest.fn().mockResolvedValue({ skillId: 's1', enabled: true }),
      saveCustom: jest.fn().mockResolvedValue({ _id: 'm1' }),
    };
    controller = new ConnectionsController(service);
  });

  const user = (sub: string) => ({ sub, sid: 'sess', perms: [] }) as any;

  it('is protected by JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', ConnectionsController);
    expect(guards).toContain(JwtAuthGuard);
  });

  it('listConnections uses req.user.sub, not a query param', async () => {
    await controller.listConnections(user('jwt-user'));
    expect(service.listConnections).toHaveBeenCalledWith('jwt-user');
  });

  it('listSkills uses req.user.sub', async () => {
    await controller.listSkills(user('jwt-user'));
    expect(service.listSkills).toHaveBeenCalledWith('jwt-user');
  });

  it('setSkill uses req.user.sub (skillId/enabled from body)', async () => {
    await controller.setSkill(user('jwt-user'), {
      skillId: 's1',
      enabled: true,
    } as any);
    expect(service.setSkill).toHaveBeenCalledWith('jwt-user', 's1', true);
  });
});
