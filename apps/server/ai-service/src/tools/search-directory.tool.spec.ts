import { Types } from 'mongoose';
import { SearchDirectoryTool } from './search-directory.tool';
import { ToolContext } from './tool.interface';

const ctx: ToolContext = { conversationId: 'c1', userId: 'u1', displayName: 'x' };

function cursor(rows: unknown[]) {
  const c: any = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    toArray: jest.fn().mockResolvedValue(rows),
  };
  return c;
}

describe('SearchDirectoryTool', () => {
  const bod = { _id: new Types.ObjectId(), name: 'Ban Giám đốc', description: 'Điều hành', leadUserId: new Types.ObjectId() };
  const fleet = { _id: new Types.ObjectId(), name: 'Phòng FleetPro', leadUserId: new Types.ObjectId() };
  const adminRole = { _id: new Types.ObjectId(), name: 'Admin' };
  const khang = { _id: bod.leadUserId, displayName: 'Trần Phúc Khang', bio: 'CEO', email: 'khang@lumensoft.vn', roleId: adminRole._id, departmentIds: [bod._id] };
  const huy = { _id: fleet.leadUserId, displayName: 'Đặng Quốc Huy', bio: 'Trưởng phòng FleetPro', email: 'huy@lumensoft.vn', departmentIds: [fleet._id], hideInfo: true };

  let users: any;
  let connection: any;

  beforeEach(() => {
    users = {
      find: jest.fn(),
      aggregate: jest.fn().mockReturnValue(cursor([{ _id: bod._id, n: 3 }, { _id: fleet._id, n: 9 }])),
    };
    const roles = { find: jest.fn().mockReturnValue(cursor([adminRole])) };
    const departments = { find: jest.fn().mockReturnValue(cursor([bod, fleet])) };
    connection = {
      collection: jest.fn((name: string) => ({ users, roles, departments })[name]),
    };
  });

  it('lists every department with headcount and head when called without input', async () => {
    users.find.mockReturnValue(cursor([khang, huy]));
    const out = await new SearchDirectoryTool(connection).execute({}, ctx);
    expect(out).toContain('2 departments');
    expect(out).toContain('- Ban Giám đốc: 3 people, head: Trần Phúc Khang — Điều hành');
    expect(out).toContain('- Phòng FleetPro: 9 people, head: Đặng Quốc Huy');
    // Only active, non-bot members count.
    expect(users.aggregate.mock.calls[0][0][0]).toEqual({ $match: { status: 'active', isBot: { $ne: true } } });
  });

  it('lists the members of a department, hiding the email of a member who hid their profile', async () => {
    users.find.mockReturnValue(cursor([huy]));
    const out = await new SearchDirectoryTool(connection).execute({ department: 'fleetpro' }, ctx);
    expect(out).toContain('Phòng FleetPro (head: Đặng Quốc Huy) — 1 people');
    expect(out).toContain('- Đặng Quốc Huy — Trưởng phòng FleetPro — dept: Phòng FleetPro');
    expect(out).not.toContain('huy@lumensoft.vn');
    expect(users.find.mock.calls[0][0]).toMatchObject({ status: 'active', departmentIds: { $in: [fleet._id] } });
  });

  it('searches people by name or title literally (no regex injection) and shows role + email', async () => {
    users.find.mockReturnValue(cursor([khang]));
    const out = await new SearchDirectoryTool(connection).execute({ query: 'CEO (.*' }, ctx);
    expect(out).toContain("People matching 'CEO (.*' — 1 people");
    expect(out).toContain('- Trần Phúc Khang — CEO — role: Admin — dept: Ban Giám đốc — khang@lumensoft.vn');
    const filter = users.find.mock.calls[0][0];
    expect(filter.$or[0].displayName.$regex).toBe('CEO \\(\\.\\*');
  });

  it('names the departments when the requested one does not exist', async () => {
    const out = await new SearchDirectoryTool(connection).execute({ department: 'Marketing' }, ctx);
    expect(out).toBe("No department matches 'Marketing'. Departments: Ban Giám đốc, Phòng FleetPro");
    expect(users.find).not.toHaveBeenCalled();
  });

  it('says so when nobody matches', async () => {
    users.find.mockReturnValue(cursor([]));
    expect(await new SearchDirectoryTool(connection).execute({ query: 'zzz' }, ctx)).toBe("No one in the directory matches 'zzz'.");
  });
});
