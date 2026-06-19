import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { VaultModule } from '../vault/vault.module';
import { McpModule } from '../mcp/mcp.module';
import { InternalService } from './internal.service';
import { InternalController } from './internal.controller';

@Module({
  imports: [ConnectionsModule, VaultModule, McpModule],
  controllers: [InternalController],
  providers: [InternalService],
})
export class InternalModule {}
