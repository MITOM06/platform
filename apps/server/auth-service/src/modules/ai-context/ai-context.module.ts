import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import {
  AiContextEntry,
  AiContextEntrySchema,
  AiUserContext,
  AiUserContextSchema,
  Department,
  DepartmentSchema,
  Role,
  RoleSchema,
  User,
  UserSchema,
} from '@platform/database';
import { AuditModule } from '../audit/audit.module';
import { ClaimsService } from '../auth/claims.service';
import { RequirePermissionGuard } from '../auth/guards/require-permission.guard';
import { AiContextService } from './ai-context.service';
import { AiContextController } from './ai-context.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    AuditModule,
    MongooseModule.forFeature([
      { name: AiContextEntry.name, schema: AiContextEntrySchema },
      { name: AiUserContext.name, schema: AiUserContextSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AiContextController],
  providers: [AiContextService, ClaimsService, RequirePermissionGuard],
})
export class AiContextModule {}
