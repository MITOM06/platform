import { Injectable } from '@nestjs/common';
import { AiContextReaderService, OrgEntry } from '../ai-context/ai-context-reader.service';
import { ToolContext, ToolDefinition } from './tool.interface';

/**
 * Reads the AI-context notes of a department on demand. The prompt carries the
 * user's own department notes in full but only the TITLES of other
 * departments' notes (Owner/Admin see every department — inlining them all
 * would not fit any budget). Same visibility rule as the prompt
 * (`isContextEntryVisible` via the reader), so a member asking about another
 * department gets nothing back — not even whether a note exists.
 */
@Injectable()
export class GetDepartmentContextTool {
  static readonly definition: ToolDefinition = {
    name: 'get_department_context',
    description:
      "Read the internal notes of a department (policies, customers, stack, processes) that this user is allowed to see. " +
      "Use it when the question is about a department whose note titles are listed under \"Other departments\" in the org context, " +
      'or to re-read the full text of a department note. Returns nothing for departments the user may not see.',
    input_schema: {
      type: 'object',
      properties: {
        department: { type: 'string', description: 'Department name, or part of it (e.g. "Kinh doanh", "Sales").' },
      },
      required: ['department'],
    },
  };

  constructor(private readonly reader: AiContextReaderService) {}

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const wanted = typeof input['department'] === 'string' ? input['department'].trim().toLowerCase() : '';
    if (!wanted) return 'Provide a department name.';
    const org = await this.reader.getUserOrgContext({
      userId: ctx.userId,
      perms: ctx.perms ?? [],
      departmentIds: ctx.departmentIds ?? [],
    });
    const matches = (e: OrgEntry) => (e.department ?? '').toLowerCase().includes(wanted);
    const found = [...org.departmentEntries, ...(org.otherDepartmentEntries ?? [])].filter(matches);
    if (!found.length) return `No department notes visible to this user match "${input['department']}".`;
    return found.map((e) => `[${e.department}] ${e.label}: ${e.text}`).join('\n');
  }
}
