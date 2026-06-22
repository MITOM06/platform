import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workspace, WorkspaceSchema } from '@platform/database';
import { ConnectionsModule } from '../connections/connections.module';
import { DirectoryModule } from '../directory/directory.module';
import { VaultModule } from '../vault/vault.module';
import { AuditModule } from '../audit/audit.module';
import { OAuthService } from './oauth.service';
import { McpOAuthService } from './mcp-oauth.service';
import { DirectoryConnectService } from './directory-connect.service';
import { OAuthController } from './oauth.controller';

@Module({
  imports: [
    ConnectionsModule,
    DirectoryModule,
    VaultModule,
    AuditModule,
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
  ],
  controllers: [OAuthController],
  providers: [OAuthService, McpOAuthService, DirectoryConnectService],
  exports: [OAuthService],
})
export class OAuthModule {}
