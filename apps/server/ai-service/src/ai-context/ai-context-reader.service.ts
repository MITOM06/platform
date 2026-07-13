import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import {
  AiContextEntry,
  AiContextEntryDocument,
  AiUserContext,
  AiUserContextDocument,
  Capability,
  Department,
  DepartmentDocument,
} from '@platform/database';

export interface OrgEntry {
  label: string;
  text: string;
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
  departmentEntries: OrgEntry[];
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

  private gate(perms: string[], cap: Capability | null | undefined): boolean {
    return cap == null || perms.includes(cap);
  }

  private async load(input: {
    userId: string;
    perms: string[];
    departmentIds: string[];
    role?: string;
  }): Promise<OrgContext> {
    try {
      const [profileDoc, companyDocs, deptDocs, deptNameDocs] = await Promise.all([
        this.userCtxModel.findOne({ userId: input.userId }).lean().exec(),
        this.entryModel.find({ scope: 'company' }).sort({ updatedAt: -1 }).lean().exec(),
        input.departmentIds.length
          ? this.entryModel
              .find({ scope: 'department', scopeId: { $in: input.departmentIds } })
              .sort({ updatedAt: -1 })
              .lean()
              .exec()
          : Promise.resolve([] as AiContextEntry[]),
        input.departmentIds.length
          ? this.deptModel.find({ _id: { $in: input.departmentIds } }).lean().exec()
          : Promise.resolve([] as Department[]),
      ]);

      const toEntry = (e: any): OrgEntry => ({
        label: String(e.label ?? ''),
        text: String(e.text ?? ''),
      });
      const p = profileDoc as any;
      return {
        role: input.role,
        departmentNames: (deptNameDocs as any[])
          .map((d) => String(d.name ?? ''))
          .filter(Boolean),
        profile: p
          ? {
              jobTitle: String(p.jobTitle ?? ''),
              projects: Array.isArray(p.projects) ? p.projects.map(String) : [],
              style: String(p.style ?? ''),
              preferences: String(p.preferences ?? ''),
            }
          : null,
        companyEntries: (companyDocs as any[])
          .filter((e) => this.gate(input.perms, e.requiredCapability))
          .map(toEntry),
        departmentEntries: (deptDocs as any[])
          .filter((e) => this.gate(input.perms, e.requiredCapability))
          .map(toEntry),
      };
    } catch (err) {
      this.logger.warn(`Org-context read failed for ${input.userId}: ${(err as Error).message}`);
      return EMPTY;
    }
  }
}
