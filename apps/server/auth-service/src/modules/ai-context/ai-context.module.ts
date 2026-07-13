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
  User,
  UserSchema,
} from '@platform/database';
import { RequirePermissionGuard } from '../auth/guards/require-permission.guard';
import { AiContextService } from './ai-context.service';
import { AiContextController } from './ai-context.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([
      { name: AiContextEntry.name, schema: AiContextEntrySchema },
      { name: AiUserContext.name, schema: AiUserContextSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AiContextController],
  providers: [AiContextService, RequirePermissionGuard],
})
export class AiContextModule {}
