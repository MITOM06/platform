import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Role,
  RoleSchema,
  User,
  UserSchema,
  Workspace,
  WorkspaceSchema,
} from '@platform/database';
import { AuditModule } from '../audit/audit.module';
import { SessionService } from '../auth/session.service';
import { SsoEnforcementService } from './sso-enforcement.service';
import { SsoPolicyService } from './sso-policy.service';

/**
 * "Require SSO" (workspace `sso.enforced`): the policy every password /
 * Google / recovery path checks, and the admin-side switch. Imported by
 * AuthModule, UsersModule, InvitationsModule and AdminModule; it imports none
 * of them (no cycle). REDIS_CLIENT comes from the global DatabaseRedisModule.
 */
@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [SsoPolicyService, SsoEnforcementService, SessionService],
  exports: [SsoPolicyService, SsoEnforcementService],
})
export class SsoModule {}
