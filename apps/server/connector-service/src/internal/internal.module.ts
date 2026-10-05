import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { AuditModule } from '../audit/audit.module';
import { AdapterModule } from '../adapters/adapter.module';
import { GovernanceModule } from '../governance/governance.module';
import { InternalService } from './internal.service';
import { InternalController } from './internal.controller';

@Module({
  imports: [ConnectionsModule, AuditModule, AdapterModule, GovernanceModule],
  controllers: [InternalController],
  providers: [InternalService],
  exports: [InternalService],
})
export class InternalModule {}
