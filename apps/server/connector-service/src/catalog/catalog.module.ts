import { Module } from '@nestjs/common';
import { GovernanceModule } from '../governance/governance.module';
import { CatalogController } from './catalog.controller';

@Module({ imports: [GovernanceModule], controllers: [CatalogController] })
export class CatalogModule {}
