import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VaultModule } from '../vault/vault.module';
import { McpModule } from '../mcp/mcp.module';
import { AuditModule } from '../audit/audit.module';
import { AdapterModule } from '../adapters/adapter.module';
import { UserConnection, UserConnectionSchema } from './schemas/user-connection.schema';
import { CustomMcpServer, CustomMcpServerSchema } from './schemas/custom-mcp-server.schema';
import { UserSkill, UserSkillSchema } from './schemas/user-skill.schema';
import { ConnectionsService } from './connections.service';
import { ConnectionStoreService } from './connection-store.service';
import { CustomMcpService } from './custom-mcp.service';
import { ConnectionsController } from './connections.controller';

const mongoFeature = MongooseModule.forFeature([
  { name: UserConnection.name, schema: UserConnectionSchema },
  { name: CustomMcpServer.name, schema: CustomMcpServerSchema },
  { name: UserSkill.name, schema: UserSkillSchema },
]);

@Module({
  imports: [mongoFeature, VaultModule, McpModule, AuditModule, AdapterModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, ConnectionStoreService, CustomMcpService],
  exports: [mongoFeature, ConnectionsService, ConnectionStoreService],
})
export class ConnectionsModule {}
