import { JwtAuthGuard } from '@platform/database';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConnectionsController } from './connections.controller';
import { UpdateConnectionPermissionsDto } from './dto/connection-permissions.dto';

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
    };
    controller = new ConnectionsController(service, {} as any);
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

describe('Connection permissions endpoint (full authority)', () => {
  const user = (sub: string) => ({ sub, sid: 'sess', perms: [] }) as any;

  it('passes the JWT user (never a body field) as the owner of the update', async () => {
    const service = { updateConnectionPermissions: jest.fn().mockResolvedValue({}), getConnectionPermissions: jest.fn() };
    const controller = new ConnectionsController(service as any, {} as any);
    await controller.updateConnectionPermissions(user('owner'), 'id1', { actionGroups: ['view'], autoRun: true, userId: 'victim' } as any);
    expect(service.updateConnectionPermissions).toHaveBeenCalledWith('owner', 'id1', ['view'], true);
    await controller.getConnectionPermissions(user('owner'), 'id1');
    expect(service.getConnectionPermissions).toHaveBeenCalledWith('owner', 'id1');
  });

  const errorsOf = async (body: unknown) =>
    (await validate(plainToInstance(UpdateConnectionPermissionsDto, body))).map((e) => e.property);

  it('accepts a valid body, with or without autoRun', async () => {
    expect(await errorsOf({ actionGroups: ['view', 'create'], autoRun: true })).toEqual([]);
    expect(await errorsOf({ actionGroups: [] })).toEqual([]);
  });

  it.each([
    [{ actionGroups: ['view'], autoRun: 'true' }, 'autoRun'],
    [{ actionGroups: ['view'], autoRun: 1 }, 'autoRun'],
    [{ actionGroups: ['admin'] }, 'actionGroups'],
    [{ actionGroups: ['view', 'view'] }, 'actionGroups'],
    [{ actionGroups: 'view' }, 'actionGroups'],
    [{}, 'actionGroups'],
  ])('rejects %p', async (body, field) => {
    expect(await errorsOf(body)).toContain(field);
  });
});
