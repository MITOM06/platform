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
}
