import { Module } from '@nestjs/common';
import { MemoryModule } from '../memory/memory.module';
import { KbModule } from '../kb/kb.module';
import { RetentionService } from './retention.service';

@Module({
  imports: [MemoryModule, KbModule],
  providers: [RetentionService],
})
export class RetentionModule {}
