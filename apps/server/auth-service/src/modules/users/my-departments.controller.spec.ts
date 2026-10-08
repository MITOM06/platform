import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { MyDepartmentsController } from './my-departments.controller';

describe('MyDepartmentsController — GET /api/users/me/departments', () => {
  it("lists the caller's departments from the JWT subject", async () => {
    const service = {
      listMine: jest.fn().mockResolvedValue([{ id: 'd1', name: 'Sales' }]),
    };
    const controller = new MyDepartmentsController(service as any);

    await expect(controller.listMine({ user: { sub: 'u1', perms: [] } })).resolves.toEqual([
      { id: 'd1', name: 'Sales' },
    ]);
    expect(service.listMine).toHaveBeenCalledWith('u1');
  });

  it('is a JWT-protected GET on api/users/me/departments (no capability)', () => {
    expect(Reflect.getMetadata(PATH_METADATA, MyDepartmentsController)).toBe('api/users');
    const handler = MyDepartmentsController.prototype.listMine;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('me/departments');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    const guards = Reflect.getMetadata(GUARDS_METADATA, MyDepartmentsController) ?? [];
    expect(guards).toHaveLength(1);
  });
});
