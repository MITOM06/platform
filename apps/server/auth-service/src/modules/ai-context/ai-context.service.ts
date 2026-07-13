import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AiContextEntry,
  AiContextEntryDocument,
  AiUserContext,
  AiUserContextDocument,
  Capability,
  Department,
  DepartmentDocument,
  User,
  UserDocument,
} from '@platform/database';

export interface Actor {
  sub: string;
  perms: string[];
}

const EMPTY_CONTEXT = (userId: string): AiUserContext =>
  ({
    userId,
    jobTitle: '',
    projects: [],
    style: '',
    preferences: '',
    updatedBy: userId,
  } as AiUserContext);

@Injectable()
export class AiContextService {
  constructor(
    @InjectModel(AiUserContext.name)
    private readonly userCtxModel: Model<AiUserContextDocument>,
    @InjectModel(AiContextEntry.name)
    private readonly entryModel: Model<AiContextEntryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Department.name)
    private readonly deptModel: Model<DepartmentDocument>,
  ) {}

  async resolveDepartmentNames(deptIds: string[]): Promise<string[]> {
    if (!deptIds || deptIds.length === 0) return [];
    try {
      const docs = await this.deptModel.find({ _id: { $in: deptIds } }).lean().exec();
      const byId = new Map(
        (docs as any[]).map((d) => [String(d._id), String(d.name ?? '')]),
      );
      return deptIds
        .map((id) => byId.get(String(id)))
        .filter((n): n is string => !!n);
    } catch {
      return [];
    }
  }

  async getUserContext(userId: string): Promise<AiUserContext> {
    const doc = await this.userCtxModel.findOne({ userId }).lean().exec();
    return (doc as AiUserContext) ?? EMPTY_CONTEXT(userId);
  }

  async updateSoftContext(
    actorId: string,
    dto: { style?: string; preferences?: string },
  ): Promise<AiUserContext> {
    const set: Record<string, unknown> = { updatedBy: actorId };
    if (dto.style !== undefined) set.style = dto.style;
    if (dto.preferences !== undefined) set.preferences = dto.preferences;
    return this.userCtxModel
      .findOneAndUpdate({ userId: actorId }, { $set: set }, { upsert: true, new: true })
      .lean()
      .exec() as Promise<AiUserContext>;
  }

  async updateHardContext(
    actor: Actor,
    targetUserId: string,
    dto: { jobTitle?: string; projects?: string[] },
  ): Promise<AiUserContext> {
    if (!(await this.canManageMemberHardFields(actor, targetUserId))) {
      throw new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION' });
    }
    const set: Record<string, unknown> = { updatedBy: actor.sub };
    if (dto.jobTitle !== undefined) set.jobTitle = dto.jobTitle;
    if (dto.projects !== undefined) set.projects = dto.projects;
    return this.userCtxModel
      .findOneAndUpdate({ userId: targetUserId }, { $set: set }, { upsert: true, new: true })
      .lean()
      .exec() as Promise<AiUserContext>;
  }

  async canManageMemberHardFields(
    actor: Actor,
    targetUserId: string,
  ): Promise<boolean> {
    if (actor.perms.includes(Capability.MANAGE_MEMBERS)) return true;
    const target = await this.userModel.findById(targetUserId).lean().exec();
    if (!target) return false;
    const targetDeptIds = (
      (target as unknown as { departmentIds?: unknown[] }).departmentIds ?? []
    ).map((d) => String(d));
    if (targetDeptIds.length === 0) return false;
    const ledDepts = await this.deptModel.find({ leadUserId: actor.sub }).lean().exec();
    return ledDepts.some((d) =>
      targetDeptIds.includes(String((d as { _id: unknown })._id)),
    );
  }

  async canManageEntryScope(
    actor: Actor,
    scope: 'company' | 'department',
    scopeId?: string | null,
  ): Promise<boolean> {
    if (actor.perms.includes(Capability.MANAGE_AI_CONTEXT)) return true;
    if (scope === 'department' && scopeId) {
      const dept = await this.deptModel.findById(scopeId).lean().exec();
      return (
        !!dept &&
        String((dept as { leadUserId?: unknown }).leadUserId) === actor.sub
      );
    }
    return false;
  }

  async listEntries(
    scope: 'company' | 'department',
    scopeId?: string | null,
  ): Promise<AiContextEntry[]> {
    const filter: Record<string, unknown> = { scope };
    if (scope === 'department') filter.scopeId = scopeId ?? null;
    return this.entryModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .lean()
      .exec() as Promise<AiContextEntry[]>;
  }

  async upsertEntry(
    actor: Actor,
    dto: {
      scope: 'company' | 'department';
      scopeId?: string | null;
      label: string;
      text: string;
      requiredCapability?: Capability | null;
    },
    id?: string,
  ): Promise<AiContextEntry> {
    if (!(await this.canManageEntryScope(actor, dto.scope, dto.scopeId))) {
      throw new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION' });
    }
    const base = {
      scope: dto.scope,
      scopeId: dto.scope === 'department' ? dto.scopeId ?? null : null,
      label: dto.label,
      text: dto.text,
      requiredCapability: dto.requiredCapability ?? null,
      updatedBy: actor.sub,
    };
    if (id) {
      return this.entryModel
        .findByIdAndUpdate(id, { $set: base }, { new: true })
        .lean()
        .exec() as Promise<AiContextEntry>;
    }
    return this.entryModel.create({
      ...base,
      createdBy: actor.sub,
    }) as unknown as Promise<AiContextEntry>;
  }

  async deleteEntry(actor: Actor, id: string): Promise<void> {
    const entry = await this.entryModel.findById(id).lean().exec();
    if (!entry) return;
    const e = entry as unknown as {
      scope: 'company' | 'department';
      scopeId?: string | null;
    };
    if (!(await this.canManageEntryScope(actor, e.scope, e.scopeId))) {
      throw new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION' });
    }
    await this.entryModel.deleteOne({ _id: id }).exec();
  }

  async getVisibleEntriesForUser(
    _userId: string,
    perms: string[],
    departmentIds: string[],
  ): Promise<AiContextEntry[]> {
    const gate = (cap: Capability | null | undefined) =>
      cap == null || perms.includes(cap);
    const company = (await this.entryModel
      .find({ scope: 'company' })
      .sort({ updatedAt: -1 })
      .lean()
      .exec()) as AiContextEntry[];
    let dept: AiContextEntry[] = [];
    if (departmentIds.length > 0) {
      dept = (await this.entryModel
        .find({ scope: 'department', scopeId: { $in: departmentIds } })
        .sort({ updatedAt: -1 })
        .lean()
        .exec()) as AiContextEntry[];
    }
    return [...company, ...dept].filter((e) => gate(e.requiredCapability));
  }
}
