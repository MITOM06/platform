import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Workspace, Role, Department } from '@platform/database';
import { UsersService } from '../../users/users.service';
import { resolveSsoMapping } from './sso-mapping';

@Injectable()
export class SsoMappingService {
  constructor(
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<any>,
    @InjectModel(Role.name) private readonly roleModel: Model<any>,
    @InjectModel(Department.name) private readonly departmentModel: Model<any>,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  async getGate(): Promise<{ enabled: boolean; allowedDomains: string[] }> {
    const ws = await this.workspaceModel.findOne().exec();
    return {
      enabled: ws?.sso?.enabled === true,
      allowedDomains: ws?.sso?.allowedDomains ?? [],
    };
  }

  async apply(
    userId: string,
    email: string,
    groups: string[],
  ): Promise<{ changed: boolean }> {
    // Break-glass: never demote the bootstrap owner via group mapping.
    const ownerEmail = this.config.get<string>('BOOTSTRAP_OWNER_EMAIL');
    if (ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()) {
      return { changed: false };
    }

    const ws = await this.workspaceModel.findOne().exec();
    const sso = ws?.sso;
    if (!sso) return { changed: false };

    const roles = await this.roleModel.find().exec();
    const roleNameToId = new Map<string, string>(
      roles.map((r: any) => [r.name, r._id.toString()]),
    );
    const { roleId, departmentIds } = resolveSsoMapping(groups, sso, roleNameToId);

    // Filter to departments that still exist.
    const existing = await this.departmentModel.find().exec();
    const validIds = new Set(existing.map((d: any) => d._id.toString()));
    const depts = departmentIds.filter((d) => validIds.has(d));

    await this.usersService.setRoleAndDepartments(userId, roleId, depts);
    return { changed: true };
  }
}
