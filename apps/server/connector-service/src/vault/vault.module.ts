import { Module } from '@nestjs/common';
import { TokenVaultService } from './token-vault.service';

@Module({
  providers: [TokenVaultService],
  exports: [TokenVaultService],
})
export class VaultModule {}
