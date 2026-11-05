import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import {
  AiContextEntry,
  AiContextEntryDocument,
  AiUserContext,
  AiUserContextDocument,
  ContextViewer,
  contextDepartmentScope,
  Department,
  DepartmentDocument,
  isContextEntryVisible,
} from '@platform/database';

export interface OrgEntry {
  label: string;
  text: string;
  /** Department name, for department-scoped entries. */
  department?: string;
}
export interface OrgProfile {
  jobTitle: string;
  projects: string[];
  style: string;
  preferences: string;
}
export interface OrgContext {
  role?: string;
  departmentNames: string[];
  profile: OrgProfile | null;
  companyEntries: OrgEntry[];
  /** Entries of the departments the user belongs to or leads. */
  departmentEntries: OrgEntry[];
  /** Entries of other departments — only Owner/Admin (MANAGE_AI_CONTEXT) get these. */
  otherDepartmentEntries?: OrgEntry[];
}

const EMPTY: OrgContext = {
  departmentNames: [],
  profile: null,
  companyEntries: [],
  departmentEntries: [],
};

interface CacheSlot {
  at: number;
  value: OrgContext;
}

/**
 * Reads the role-aware AI context (P1 collections `ai_user_context` +
 * `ai_context_entries`, plus department NAMES) directly from the shared
 * `platform` DB, gated by the caller's `perms` + `departmentIds`. Cached per
 * cache-key for a short TTL to keep the hot path off Mongo. Fail-soft: any read
 * error yields an empty context so the turn never crashes.
 */
@Injectable()
export class AiContextReaderService {
  private readonly logger = new Logger(AiContextReaderService.name);
  private readonly ttlMs: number;
  private readonly cache = new Map<string, CacheSlot>();

  constructor(
    @InjectModel(AiUserContext.name)
    private readonly userCtxModel: Model<AiUserContextDocument>,
    @InjectModel(AiContextEntry.name)
    private readonly entryModel: Model<AiContextEntryDocument>,
    @InjectModel(Department.name)
    private readonly deptModel: Model<DepartmentDocument>,
    private readonly config: ConfigService,
  ) {
    this.ttlMs = this.config.get<number>('config.aiContext.cacheTtlMs') ?? 60000;
  }

  async getUserOrgContext(input: {
    userId: string;
    perms: string[];
    departmentIds: string[];
    role?: string;
  }): Promise<OrgContext> {
    const key = this.cacheKey(input);
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;
    const value = await this.load(input);
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  private cacheKey(input: {
    userId: string;
    perms: string[];
    departmentIds: string[];
    role?: string;
  }): string {
    return `${input.userId}|${input.role ?? ''}|${[...input.perms].sort().join(',')}|${[...input.departmentIds].sort().join(',')}`;
  }

  /**
   * Visibility is the shared rule in `@platform/database` (context-visibility):
   * company entries by capability; department entries for members and the
   * department's lead (who sees every tier of it), and for Owner/Admin across
   * every department.
   */
  private async load(input: {
    userId: string;
    perms: string[];
    departmentIds: string[];
    role?: string;
  }): Promise<OrgContext> {
    try {
      // Every department (name + lead) — a workspace has a handful, and the lead
      // rule needs them before the department entries can be scoped.
      const allDepts = (await this.deptModel.find({}).lean().exec()) as any[];
      const nameOf = new Map(allDepts.map((d) => [String(d._id), String(d.name ?? '')]));
      const viewer: ContextViewer = {
        perms: input.perms,
        departmentIds: input.departmentIds.map(String),
        ledDepartmentIds: allDepts
          .filter((d) => d.leadUserId != null && String(d.leadUserId) === input.userId)
          .map((d) => String(d._id)),
      };
      const scope = contextDepartmentScope(viewer);
      const [profileDoc, companyDocs, deptDocs] = await Promise.all([
        this.userCtxModel.findOne({ userId: input.userId }).lean().exec(),
        this.entryModel.find({ scope: 'company' }).sort({ updatedAt: -1 }).lean().exec(),
        scope === 'all' || scope.length
          ? this.entryModel
              .find(scope === 'all' ? { scope: 'department' } : { scope: 'department', scopeId: { $in: scope } })
              .sort({ updatedAt: -1 })
              .lean()
              .exec()
          : Promise.resolve([] as AiContextEntry[]),
      ]);

      const toEntry = (e: any): OrgEntry => ({
        label: String(e.label ?? ''),
        text: String(e.text ?? ''),
        ...(e.scope === 'department' ? { department: nameOf.get(String(e.scopeId)) ?? '' } : {}),
      });
      const mine = new Set([...viewer.departmentIds, ...viewer.ledDepartmentIds]);
      const visibleDept = (deptDocs as any[]).filter((e) => isContextEntryVisible(e, viewer));
      const p = profileDoc as any;
      return {
        role: input.role,
        departmentNames: viewer.departmentIds.map((id) => nameOf.get(id) ?? '').filter(Boolean),
        profile: p
          ? {
              jobTitle: String(p.jobTitle ?? ''),
              projects: Array.isArray(p.projects) ? p.projects.map(String) : [],
              style: String(p.style ?? ''),
              preferences: String(p.preferences ?? ''),
            }
          : null,
        companyEntries: (companyDocs as any[]).filter((e) => isContextEntryVisible(e, viewer)).map(toEntry),
        departmentEntries: visibleDept.filter((e) => mine.has(String(e.scopeId))).map(toEntry),
        otherDepartmentEntries: visibleDept.filter((e) => !mine.has(String(e.scopeId))).map(toEntry),
      };
    } catch (err) {
      this.logger.warn(`Org-context read failed for ${input.userId}: ${(err as Error).message}`);
      return EMPTY;
    }
  }
}
