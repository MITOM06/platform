import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  AuditLog,
  Department,
  Invitation,
  Role,
  User,
} from '@platform/database';
import { AuditService } from './audit.service';

const USER = '64b0000000000000000000a1';
const MEMBER = '64b0000000000000000000a2';
const ROLE = '64b0000000000000000000b1';
const DEPT = '64b0000000000000000000c1';
const GONE_DEPT = '64b0000000000000000000c9';
const INV = '64b0000000000000000000d1';

const lean = (value: any) => ({
  lean: () => ({ exec: jest.fn().mockResolvedValue(value) }),
});

/** find({ _id: { $in } }) stub that returns only the requested docs — and throws like
 * Mongoose would (CastError) if a non-ObjectId ever reaches $in. */
function lookupModel(docs: any[]) {
  return {
    find: jest.fn((q: any) => {
      const ids: string[] = q._id.$in;
      if (ids.some((id) => !/^[0-9a-f]{24}$/i.test(id))) {
        throw Object.assign(new Error('Cast to ObjectId failed'), {
          name: 'CastError',
        });
      }
      return { select: () => lean(docs.filter((d) => ids.includes(d._id))) };
    }),
  };
}

describe('AuditService.list', () => {
  let service: AuditService;
  let auditModel: any;
  let userModel: any;
  let roleModel: any;
  let departmentModel: any;
  let invitationModel: any;

  const rows = [
    // The boot-time Owner invitation: actorId 'system' used to 500 the whole page.
    {
      _id: 'a1',
      actorId: 'system',
      action: 'invitation.create',
      targetType: 'invitation',
      targetId: INV,
      meta: { email: 'boss@acme.com' },
      createdAt: new Date(),
    },
    {
      _id: 'a2',
      actorId: USER,
      action: 'member.update',
      targetType: 'member',
      targetId: MEMBER,
      meta: {},
    },
    {
      _id: 'a3',
      actorId: USER,
      action: 'role.update',
      targetType: 'role',
      targetId: ROLE,
      meta: {},
    },
    {
      _id: 'a4',
      actorId: USER,
      action: 'department.update',
      targetType: 'department',
      targetId: DEPT,
      meta: {},
    },
    {
      _id: 'a5',
      actorId: USER,
      action: 'department.delete',
      targetType: 'department',
      targetId: GONE_DEPT,
      meta: { name: 'Old dept' },
    },
    {
      _id: 'a6',
      actorId: USER,
      action: 'workspace.update',
      targetType: 'workspace',
      targetId: 'ws',
      meta: {},
    },
    {
      _id: 'a7',
      actorId: 'ai-bot-1',
      action: 'connector.connect',
      targetType: 'connector',
      targetId: 'gmail',
      meta: {},
    },
  ];

  beforeEach(async () => {
    auditModel = {
      find: jest.fn().mockReturnValue({
        sort: () => ({ skip: () => ({ limit: () => lean(rows) }) }),
      }),
      countDocuments: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(rows.length) }),
      create: jest.fn(),
    };
    userModel = lookupModel([
      { _id: USER, displayName: 'Khang' },
      { _id: MEMBER, displayName: 'Bob' },
    ]);
    roleModel = lookupModel([{ _id: ROLE, name: 'Support' }]);
    departmentModel = lookupModel([{ _id: DEPT, name: 'Engineering' }]);
    invitationModel = lookupModel([{ _id: INV, email: 'boss@acme.com' }]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getModelToken(AuditLog.name), useValue: auditModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: getModelToken(Department.name), useValue: departmentModel },
        { provide: getModelToken(Invitation.name), useValue: invitationModel },
      ],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  it("never sends a non-ObjectId actor ('system', bot ids) to $in; their actorName stays null", async () => {
    const res = await service.list(0, 20);
    expect(userModel.find).toHaveBeenCalledWith({
      _id: { $in: [USER, MEMBER] },
    });
    const system = res.items.find((i) => i.id === 'a1')!;
    expect(system.actorName).toBeNull();
    expect(res.items.find((i) => i.id === 'a7')!.actorName).toBeNull();
    expect(res.items.find((i) => i.id === 'a2')!.actorName).toBe('Khang');
  });

  it('adds targetName per target type (live name, else the name recorded in meta, else null)', async () => {
    const res = await service.list(0, 20);
    const nameOf = (id: string) =>
      res.items.find((i) => i.id === id)!.targetName;
    expect(nameOf('a1')).toBe('boss@acme.com');
    expect(nameOf('a2')).toBe('Bob');
    expect(nameOf('a3')).toBe('Support');
    expect(nameOf('a4')).toBe('Engineering');
    expect(nameOf('a5')).toBe('Old dept'); // deleted department
    expect(nameOf('a6')).toBeNull();
    expect(nameOf('a7')).toBeNull();
  });

  it('clamps paging and treats NaN as the default', async () => {
    const res = await service.list(NaN, NaN);
    expect(res).toMatchObject({ page: 0, limit: 20, total: rows.length });
    const big = await service.list(-3, 1000);
    expect(big).toMatchObject({ page: 0, limit: 100 });
  });
});
