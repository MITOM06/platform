import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Role, RoleSchema, User, UserSchema } from '@platform/database';
import { ConnectionsModule } from '../connections/connections.module';
import { VaultModule } from '../vault/vault.module';
import { McpModule } from '../mcp/mcp.module';
import { InternalService } from './internal.service';
import { InternalController } from './internal.controller';
import { PermResolverService } from './perm-resolver.service';

@Module({
  imports: [
    ConnectionsModule,
    VaultModule,
    McpModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [InternalController],
  providers: [InternalService, PermResolverService],
})
export class InternalModule {}
