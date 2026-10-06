import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AuditLog,
  AuditLogSchema,
  Department,
  DepartmentSchema,
  Invitation,
  InvitationSchema,
  Role,
  RoleSchema,
  User,
  UserSchema,
} from '@platform/database';
import { AuditService } from './audit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      // Read-only, to label actors/targets in GET /admin/audit.
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Invitation.name, schema: InvitationSchema },
    ]),
  ],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
