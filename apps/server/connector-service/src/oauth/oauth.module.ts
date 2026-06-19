import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workspace, WorkspaceSchema } from '@platform/database';
import { ConnectionsModule } from '../connections/connections.module';
import { VaultModule } from '../vault/vault.module';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';

@Module({
  imports: [
    ConnectionsModule,
    VaultModule,
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
  ],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
