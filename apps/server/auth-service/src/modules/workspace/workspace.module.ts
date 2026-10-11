import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Workspace,
  WorkspaceSchema,
  Department,
  DepartmentSchema,
  Invitation,
  InvitationSchema,
  Role,
  RoleSchema,
  User,
  UserSchema,
} from '@platform/database';
import { PassportModule } from '@nestjs/passport';
import { BootstrapService } from './bootstrap.service';
import { PresetRoleMigrationService } from './preset-role-migration.service';
import { WorkspaceService } from './workspace.service';
import { MeController } from './me.controller';
import { ClaimsService } from '../auth/claims.service';
import { SessionService } from '../auth/session.service';
import { AuditModule } from '../audit/audit.module';
import { InvitationsModule } from '../invitations/invitations.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    InvitationsModule,
    AuditModule,
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Invitation.name, schema: InvitationSchema },
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MeController],
  providers: [
    BootstrapService,
    PresetRoleMigrationService,
    // Stateless (Redis-backed): revokes sessions of users moved off a retired preset.
    SessionService,
    WorkspaceService,
    ClaimsService,
  ],
  exports: [MongooseModule],
})
export class WorkspaceModule {}
