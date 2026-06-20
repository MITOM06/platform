import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import {
  DatabaseRedisModule,
  Workspace,
  WorkspaceSchema,
  Department,
  DepartmentSchema,
  Role,
  RoleSchema,
  User,
  UserSchema,
} from '@platform/database';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SessionService } from '../auth/session.service';
import { RequirePermissionGuard } from '../auth/guards/require-permission.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    DatabaseRedisModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, SessionService, RequirePermissionGuard],
})
export class AdminModule {}
