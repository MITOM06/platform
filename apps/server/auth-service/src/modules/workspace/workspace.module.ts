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
import { PassportModule } from '@nestjs/passport';
import { BootstrapService } from './bootstrap.service';
import { WorkspaceService } from './workspace.service';
import { MeController } from './me.controller';
import { ClaimsService } from '../auth/claims.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MeController],
  providers: [BootstrapService, WorkspaceService, ClaimsService],
  exports: [MongooseModule],
})
export class WorkspaceModule {}
