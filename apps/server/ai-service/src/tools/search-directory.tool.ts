import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { ToolContext, ToolDefinition } from './tool.interface';

/** The query is model/user text — match it literally, never as a pattern. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface DeptDoc {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  leadUserId?: Types.ObjectId;
}

interface UserDoc {
  _id: Types.ObjectId;
  displayName: string;
  email?: string;
  bio?: string;
  roleId?: Types.ObjectId;
  departmentIds?: Types.ObjectId[];
  hideInfo?: boolean;
}

const MAX_PEOPLE = 40;

/**
 * Read-only company directory: departments (headcount, head) and people (title,
 * role, departments). Answers "ai là trưởng phòng X", "phòng FleetPro có ai",
 * "ai làm Business Analyst" from the real workspace data, which the static
 * AI-context entries cannot keep current. Only active members; a member who
 * hid their profile (`hideInfo`) is listed by name and title only.
 */
@Injectable()
export class SearchDirectoryTool {
  static readonly definition: ToolDefinition = {
    name: 'search_directory',
    description:
      'Look up the company directory: departments with their head and headcount, and people by ' +
      'name, job title or department (name, title, role, departments, work email). Use it when the ' +
      'user asks who works where, who leads a department, who holds a role, or for the org structure. ' +
      'With no input it lists every department.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Part of a person name or job title to search for (optional).',
        },
        department: {
          type: 'string',
          description: 'Department name (or part of it) to list the members of (optional).',
        },
      },
      required: [],
    },
  };

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
    const query = typeof input['query'] === 'string' ? input['query'].trim() : '';
    const department = typeof input['department'] === 'string' ? input['department'].trim() : '';

    const depts = (await this.connection.collection('departments').find({}).toArray()) as unknown as DeptDoc[];
    const deptById = new Map(depts.map((d) => [String(d._id), d]));

    let scope: DeptDoc[] | null = null;
    if (department) {
      const re = new RegExp(escapeRegex(department), 'i');
      scope = depts.filter((d) => re.test(d.name));
      if (scope.length === 0) {
        return `No department matches '${department}'. Departments: ${depts.map((d) => d.name).join(', ') || '(none)'}`;
      }
    }

    const filter: Record<string, unknown> = { status: 'active', isBot: { $ne: true } };
    if (scope) filter['departmentIds'] = { $in: scope.map((d) => d._id) };
    if (query) {
      const re = { $regex: escapeRegex(query), $options: 'i' };
      filter['$or'] = [{ displayName: re }, { bio: re }];
    }

    const users = this.connection.collection('users');
    if (!scope && !query) return this.listDepartments(depts, users);

    const people = (await users
      .find(filter, { projection: { displayName: 1, email: 1, bio: 1, roleId: 1, departmentIds: 1, hideInfo: 1 } })
      .sort({ displayName: 1 })
      .limit(MAX_PEOPLE + 1)
      .toArray()) as unknown as UserDoc[];
    if (people.length === 0) {
      return query
        ? `No one in the directory matches '${query}'${scope ? ` in ${scope.map((d) => d.name).join(', ')}` : ''}.`
        : `${scope!.map((d) => d.name).join(', ')} has no active members.`;
    }
    const roleName = await this.roleNames(people);
    const lines = people.slice(0, MAX_PEOPLE).map((u) => this.personLine(u, roleName, deptById));
    const header = scope
      ? scope.map((d) => `${d.name}${d.leadUserId ? ` (head: ${this.leadName(d, people)})` : ''}`).join(', ')
      : `People matching '${query}'`;
    const more = people.length > MAX_PEOPLE ? `\n… more than ${MAX_PEOPLE} people, narrow the search.` : '';
    return `${header} — ${Math.min(people.length, MAX_PEOPLE)} people:\n${lines.join('\n')}${more}`;
  }

  private async listDepartments(
    depts: DeptDoc[],
    users: ReturnType<Connection['collection']>,
  ): Promise<string> {
    if (depts.length === 0) return 'The workspace has no departments yet.';
    const counts = (await users
      .aggregate([
        { $match: { status: 'active', isBot: { $ne: true } } },
        { $unwind: '$departmentIds' },
        { $group: { _id: '$departmentIds', n: { $sum: 1 } } },
      ])
      .toArray()) as Array<{ _id: Types.ObjectId; n: number }>;
    const countById = new Map(counts.map((c) => [String(c._id), c.n]));
    const leadIds = depts.map((d) => d.leadUserId).filter((id): id is Types.ObjectId => !!id);
    const leads = leadIds.length
      ? ((await users
          .find({ _id: { $in: leadIds } }, { projection: { displayName: 1 } })
          .toArray()) as unknown as UserDoc[])
      : [];
    const leadName = new Map(leads.map((u) => [String(u._id), u.displayName]));
    const lines = depts.map((d) => {
      const head = d.leadUserId ? leadName.get(String(d.leadUserId)) : undefined;
      return `- ${d.name}: ${countById.get(String(d._id)) ?? 0} people${head ? `, head: ${head}` : ''}${d.description ? ` — ${d.description}` : ''}`;
    });
    return `${depts.length} departments:\n${lines.join('\n')}`;
  }

  private async roleNames(people: UserDoc[]): Promise<Map<string, string>> {
    const ids = [...new Set(people.map((u) => u.roleId).filter((r): r is Types.ObjectId => !!r).map(String))];
    if (ids.length === 0) return new Map();
    const roles = (await this.connection
      .collection('roles')
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } }, { projection: { name: 1 } })
      .toArray()) as unknown as Array<{ _id: Types.ObjectId; name: string }>;
    return new Map(roles.map((r) => [String(r._id), r.name]));
  }

  private personLine(u: UserDoc, roleName: Map<string, string>, deptById: Map<string, DeptDoc>): string {
    const parts = [u.displayName];
    if (u.bio) parts.push(u.bio);
    const role = u.roleId ? roleName.get(String(u.roleId)) : undefined;
    if (role) parts.push(`role: ${role}`);
    const deptNames = (u.departmentIds ?? []).map((id) => deptById.get(String(id))?.name).filter(Boolean);
    if (deptNames.length) parts.push(`dept: ${deptNames.join(', ')}`);
    if (u.email && !u.hideInfo) parts.push(u.email);
    return `- ${parts.join(' — ')}`;
  }

  private leadName(d: DeptDoc, people: UserDoc[]): string {
    return people.find((u) => u._id.equals(d.leadUserId!))?.displayName ?? '(not listed)';
  }
}
