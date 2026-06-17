import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiMemory, AiMemorySchema } from './ai-memory.schema';
import { MemoryService } from './memory.service';
import { MemoryVectorService } from './memory-vector.service';
import { KbModule } from '../kb/kb.module';

const memoryFeature = MongooseModule.forFeature([
  { name: AiMemory.name, schema: AiMemorySchema },
]) as unknown as DynamicModule;

@Module({
  imports: [memoryFeature, KbModule],
  providers: [MemoryService, MemoryVectorService],
  exports: [MemoryService],
})
export class MemoryModule {}
