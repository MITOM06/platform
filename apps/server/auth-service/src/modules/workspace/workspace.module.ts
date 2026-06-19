import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Workspace,
  WorkspaceSchema,
  Department,
  DepartmentSchema,
  Role,
  RoleSchema,
  User,
  UserSchema,
} from '@platform/database';
import { BootstrapService } from './bootstrap.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [BootstrapService],
  exports: [MongooseModule],
})
export class WorkspaceModule {}
