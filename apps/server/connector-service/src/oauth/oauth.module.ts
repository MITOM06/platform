import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { VaultModule } from '../vault/vault.module';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';

@Module({
  imports: [ConnectionsModule, VaultModule],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
