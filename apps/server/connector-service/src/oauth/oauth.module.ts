import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { DirectoryModule } from '../directory/directory.module';
import { VaultModule } from '../vault/vault.module';
import { AuditModule } from '../audit/audit.module';
import { GovernanceModule } from '../governance/governance.module';
import { OAuthService } from './oauth.service';
import { McpOAuthService } from './mcp-oauth.service';
import { DirectoryConnectService } from './directory-connect.service';
import { OAuthController } from './oauth.controller';

@Module({
  imports: [ConnectionsModule, DirectoryModule, VaultModule, AuditModule, GovernanceModule],
  controllers: [OAuthController],
  providers: [OAuthService, McpOAuthService, DirectoryConnectService],
  exports: [OAuthService],
})
export class OAuthModule {}
