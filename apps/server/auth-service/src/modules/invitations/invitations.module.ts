import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import {
  DatabaseRedisModule,
  Department,
  DepartmentSchema,
  Invitation,
  InvitationSchema,
  Role,
  RoleSchema,
  User,
  UserSchema,
  Workspace,
  WorkspaceSchema,
} from '@platform/database';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { SsoModule } from '../sso/sso.module';
import { RequirePermissionGuard } from '../auth/guards/require-permission.guard';
import { InvitationsService } from './invitations.service';
import { InvitationAcceptService } from './invitation-accept.service';
import { InvitationMailerService } from './invitation-mailer.service';
import { AdminInvitationsController } from './admin-invitations.controller';

/**
 * Invite-only onboarding. MailModule is @Global. Must NOT import AuthModule or
 * WorkspaceModule (both import this module).
 */
@Module({
  imports: [
    DatabaseRedisModule,
    AuditModule,
    UsersModule,
    SsoModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([
      { name: Invitation.name, schema: InvitationSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
  ],
  controllers: [AdminInvitationsController],
  providers: [
    InvitationsService,
    InvitationAcceptService,
    InvitationMailerService,
    RequirePermissionGuard,
  ],
  exports: [InvitationsService, InvitationAcceptService],
})
export class InvitationsModule {}
