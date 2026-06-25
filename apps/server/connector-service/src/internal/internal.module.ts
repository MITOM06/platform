import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Role, RoleSchema, User, UserSchema } from '@platform/database';
import { ConnectionsModule } from '../connections/connections.module';
import { AuditModule } from '../audit/audit.module';
import { AdapterModule } from '../adapters/adapter.module';
import { InternalService } from './internal.service';
import { InternalController } from './internal.controller';
import { PermResolverService } from './perm-resolver.service';

@Module({
  imports: [
    ConnectionsModule,
    AuditModule,
    AdapterModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [InternalController],
  providers: [InternalService, PermResolverService],
  exports: [InternalService],
})
export class InternalModule {}
