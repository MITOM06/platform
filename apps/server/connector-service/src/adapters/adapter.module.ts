import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VaultModule } from '../vault/vault.module';
import { McpModule } from '../mcp/mcp.module';
import {
  UserConnection,
  UserConnectionSchema,
} from '../connections/schemas/user-connection.schema';
import { McpOAuthService } from '../oauth/mcp-oauth.service';
import { RemoteMcpAdapter } from './remote-mcp.adapter';
import { GoogleRestAdapter } from './google-rest.adapter';
import { NotionRestAdapter } from './notion-rest.adapter';
import { AdapterRegistryService } from './adapter-registry.service';

/**
 * Provides the provider-adapter registry (remote-mcp + google-rest + notion-rest) used by the
 * internal tools service to fetch/run a user's connector tools.
 */
@Module({
  imports: [
    VaultModule,
    McpModule,
    MongooseModule.forFeature([
      { name: UserConnection.name, schema: UserConnectionSchema },
    ]),
  ],
  providers: [
    McpOAuthService,
    RemoteMcpAdapter,
    GoogleRestAdapter,
    NotionRestAdapter,
    AdapterRegistryService,
  ],
  exports: [AdapterRegistryService],
})
export class AdapterModule {}
