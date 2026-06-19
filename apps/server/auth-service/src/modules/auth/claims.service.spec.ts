import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Capability, Role, User } from '@platform/database';
import { ClaimsService } from './claims.service';

describe('ClaimsService', () => {
  let service: ClaimsService;
  let userModel: any;
  let roleModel: any;

  function lean(value: any) {
    return { lean: () => ({ exec: jest.fn().mockResolvedValue(value) }) };
  }

  beforeEach(async () => {
    userModel = { findById: jest.fn() };
    roleModel = { findById: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ClaimsService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Role.name), useValue: roleModel },
      ],
    }).compile();

    service = moduleRef.get(ClaimsService);
  });

  it('maps a role permission matrix to the enabled-capability array', async () => {
    userModel.findById.mockReturnValue(
      lean({ _id: 'u1', roleId: 'r1', departmentIds: ['d1', 'd2'] }),
    );
    roleModel.findById.mockReturnValue(
      lean({
        _id: 'r1',
        name: 'Manager',
        permissions: {
          [Capability.USE_PERSONAL_ASSISTANT]: true,
          [Capability.RUN_SENSITIVE_SKILL]: true,
          [Capability.MANAGE_MEMBERS]: false,
        },
      }),
    );

    const claims = await service.resolve('u1');

    expect(claims.role).toBe('Manager');
    expect(claims.perms.sort()).toEqual(
      [Capability.RUN_SENSITIVE_SKILL, Capability.USE_PERSONAL_ASSISTANT].sort(),
    );
    expect(claims.depts).toEqual(['d1', 'd2']);
  });

  it('falls back to Member with empty perms/depts when user has no role', async () => {
    userModel.findById.mockReturnValue(
      lean({ _id: 'u1', roleId: undefined, departmentIds: [] }),
    );

    const claims = await service.resolve('u1');

    expect(claims).toEqual({ role: 'Member', perms: [], depts: [] });
    expect(roleModel.findById).not.toHaveBeenCalled();
  });

  it('falls back when the user does not exist', async () => {
    userModel.findById.mockReturnValue(lean(null));
    const claims = await service.resolve('missing');
    expect(claims).toEqual({ role: 'Member', perms: [], depts: [] });
  });

  it('stringifies ObjectId departmentIds', async () => {
    userModel.findById.mockReturnValue(
      lean({
        _id: 'u1',
        roleId: undefined,
        departmentIds: [{ toString: () => 'dep-1' }],
      }),
    );
    const claims = await service.resolve('u1');
    expect(claims.depts).toEqual(['dep-1']);
  });
});
